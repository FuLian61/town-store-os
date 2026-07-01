import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  apiError,
  handleZodError,
  prismaErrorStatus,
} from "@/lib/api";
import {
  createSaleSchema,
  listSalesQuerySchema,
} from "@/lib/validators/sale";

// 销售列表（按时间倒序）
export async function GET(request: NextRequest) {
  const parsed = listSalesQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  );
  if (!parsed.success) return handleZodError(parsed.error);

  const { from, to, limit } = parsed.data;
  const where: Prisma.SaleWhereInput = {};
  if (from || to) {
    where.soldAt = {};
    if (from) where.soldAt.gte = from;
    if (to) where.soldAt.lte = to;
  }

  const sales = await prisma.sale.findMany({
    where,
    orderBy: { soldAt: "desc" },
    take: limit,
    include: {
      items: {
        include: {
          product: {
            select: { id: true, name: true, spec: true, brand: true },
          },
        },
      },
    },
  });
  return NextResponse.json({ sales });
}

// 销售开单：单事务里创建 Sale + SaleItems + 扣库存 + 写流水
export async function POST(request: NextRequest) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return apiError("请求体不是合法 JSON", 400, "INVALID_JSON");
  }

  const parsed = createSaleSchema.safeParse(json);
  if (!parsed.success) return handleZodError(parsed.error);

  const { items, note } = parsed.data;
  // 合并重复商品（同一商品加多行 → 累计数量）
  const aggregated = new Map<string, number>();
  for (const it of items) {
    aggregated.set(it.productId, (aggregated.get(it.productId) ?? 0) + it.quantity);
  }
  const productIds = [...aggregated.keys()];

  try {
    const sale = await prisma.$transaction(
      async (tx) => {
        // 1) 一次性拉取所有相关商品
        const products = await tx.product.findMany({
          where: { id: { in: productIds } },
          select: {
            id: true,
            name: true,
            costPrice: true,
            salePrice: true,
            stock: true,
          },
        });
        const productMap = new Map(products.map((p) => [p.id, p]));

        // 2) 校验：商品存在 + 库存足够（在事务里校验，挡住大部分竞态）
        const fieldErrors: Record<string, string[]> = {};
        for (const [pid, qty] of aggregated) {
          const p = productMap.get(pid);
          if (!p) {
            fieldErrors[`items.${pid}`] = [`商品不存在: ${pid}`];
            continue;
          }
          if (p.stock < qty) {
            fieldErrors[`items.${pid}`] = [
              `${p.name} 库存不足（剩余 ${p.stock}，需 ${qty}）`,
            ];
          }
        }
        if (Object.keys(fieldErrors).length > 0) {
          throw new HttpError(
            422,
            "库存校验失败",
            "INSUFFICIENT_STOCK",
            fieldErrors,
          );
        }

        // 3) 计算汇总（用 Decimal 数学，避免浮点误差）
        let totalAmount = new Prisma.Decimal(0);
        let totalCost = new Prisma.Decimal(0);
        const saleItemInputs: Prisma.SaleItemCreateWithoutSaleInput[] = [];
        const stockMovementInputs: Prisma.StockMovementCreateWithoutProductInput[] =
          [];

        for (const [pid, qty] of aggregated) {
          const p = productMap.get(pid)!;
          const subtotal = p.salePrice.mul(qty);
          const cost = p.costPrice.mul(qty);
          const profit = subtotal.sub(cost);
          totalAmount = totalAmount.add(subtotal);
          totalCost = totalCost.add(cost);

          saleItemInputs.push({
            product: { connect: { id: pid } },
            quantity: qty,
            salePrice: p.salePrice,
            costPrice: p.costPrice,
            subtotal,
            profit,
          });
          // 注意：beforeStock/afterStock 在步骤 4 原子扣减后填入
          stockMovementInputs.push({
            type: "SALE_OUT",
            quantity: -qty,
            beforeStock: p.stock, // 占位，下面会被真实值覆盖
            afterStock: p.stock - qty,
            referenceType: "sale",
            note: null,
          });
        }

        // 4) 原子扣减库存（WHERE stock >= qty 挡掉竞态）
        const stockUpdates: { productId: string; qty: number; before: number }[] = [];
        for (const [pid, qty] of aggregated) {
          const before = productMap.get(pid)!.stock;
          const result = await tx.product.updateMany({
            where: { id: pid, stock: { gte: qty } },
            data: { stock: { decrement: qty } },
          });
          if (result.count === 0) {
            // 极端并发：校验时库存够，但事务提交时已经被别人扣光了
            const p = productMap.get(pid)!;
            throw new HttpError(
              409,
              "库存不足",
              "INSUFFICIENT_STOCK",
              {
                [`items.${pid}`]: [
                  `${p.name} 库存被并发扣减，请重试`,
                ],
              },
            );
          }
          stockUpdates.push({ productId: pid, qty, before });
        }

        // 5) 创建 Sale + SaleItems
        const created = await tx.sale.create({
          data: {
            totalAmount,
            totalCost,
            totalProfit: totalAmount.sub(totalCost),
            itemCount: [...aggregated.values()].reduce((a, b) => a + b, 0),
            note,
            items: {
              create: saleItemInputs,
            },
          },
          include: {
            items: {
              include: {
                product: {
                  select: { id: true, name: true, spec: true, brand: true },
                },
              },
            },
          },
        });

        // 6) 写库存流水（关联回 saleId）
        for (let i = 0; i < stockUpdates.length; i++) {
          const u = stockUpdates[i];
          const itemInput = saleItemInputs[i];
          await tx.stockMovement.create({
            data: {
              productId: u.productId,
              type: "SALE_OUT",
              quantity: -u.qty,
              beforeStock: u.before,
              afterStock: u.before - u.qty,
              referenceType: "sale",
              referenceId: created.id,
              note: note,
            },
          });
          // 静默标记 itemInput 已使用（避免 lint 警告）
          void itemInput;
        }

        return created;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    return NextResponse.json({ sale }, { status: 201 });
  } catch (err) {
    if (err instanceof HttpError) {
      return apiError(err.message, err.status, err.code, err.fields);
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      const status = prismaErrorStatus(err.code);
      if (status) return apiError(err.message, status, err.code);
    }
    // Serialization failure: 重试一次
    if (
      err instanceof Prisma.PrismaClientUnknownRequestError ||
      (err instanceof Error && err.message.includes("could not serialize"))
    ) {
      return apiError(
        "并发冲突，请重试",
        409,
        "SERIALIZATION_FAILURE",
      );
    }
    console.error("create sale failed", err);
    return apiError("服务器内部错误", 500, "INTERNAL_ERROR");
  }
}

class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code: string,
    public fields?: Record<string, string[]>,
  ) {
    super(message);
  }
}