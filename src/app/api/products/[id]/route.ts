import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  apiError,
  handleZodError,
  prismaErrorStatus,
} from "@/lib/api";
import { updateProductSchema } from "@/lib/validators/product";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      _count: { select: { saleItems: true, stockMovements: true } },
    },
  });
  if (!product) return apiError("商品不存在", 404, "NOT_FOUND");
  return NextResponse.json({ product });
}

// 更新商品：若 stock 变化，写入库存流水（ADJUSTMENT）
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return apiError("请求体不是合法 JSON", 400, "INVALID_JSON");
  }

  const parsed = updateProductSchema.safeParse(json);
  if (!parsed.success) return handleZodError(parsed.error);

  const patch = parsed.data;

  try {
    const product = await prisma.$transaction(async (tx) => {
      const before = await tx.product.findUnique({ where: { id } });
      if (!before) throw new HttpError(404, "商品不存在", "NOT_FOUND");

      // PATCH 模式下部分字段缺失，需要合并现有值后才能校验 "售价 >= 进价"
      const mergedSalePrice =
        patch.salePrice !== undefined ? patch.salePrice : before.salePrice;
      const mergedCostPrice =
        patch.costPrice !== undefined ? patch.costPrice : before.costPrice;
      if (mergedSalePrice < mergedCostPrice) {
        throw new HttpError(
          422,
          "请求参数校验失败",
          "VALIDATION_ERROR",
          { salePrice: ["售价应大于等于进价"] },
        );
      }

      const updated = await tx.product.update({ where: { id }, data: patch });

      // stock 变化时记录调整流水
      if (
        patch.stock !== undefined &&
        patch.stock !== before.stock
      ) {
        const delta = updated.stock - before.stock;
        await tx.stockMovement.create({
          data: {
            productId: id,
            type: "ADJUSTMENT",
            quantity: delta,
            beforeStock: before.stock,
            afterStock: updated.stock,
            referenceType: "manual",
            note: "手动调整库存",
          },
        });
      }

      return updated;
    });
    return NextResponse.json({ product });
  } catch (err) {
    if (err instanceof HttpError) {
      return apiError(err.message, err.status, err.code, err.fields);
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      const status = prismaErrorStatus(err.code);
      if (status === 409) {
        return apiError("条码已存在", 409, "DUPLICATE_BARCODE");
      }
      if (status) return apiError(err.message, status, err.code);
    }
    console.error("update product failed", err);
    return apiError("服务器内部错误", 500, "INTERNAL_ERROR");
  }
}

// 删除商品：有销售明细引用时拒绝（保护历史数据完整性）
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const saleItemCount = await prisma.saleItem.count({ where: { productId: id } });
  if (saleItemCount > 0) {
    return apiError(
      `该商品有 ${saleItemCount} 条销售记录，无法删除。可考虑下架处理。`,
      409,
      "PRODUCT_HAS_HISTORY",
    );
  }
  try {
    await prisma.product.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      const status = prismaErrorStatus(err.code);
      if (status === 404) return apiError("商品不存在", 404, "NOT_FOUND");
      if (status) return apiError(err.message, status, err.code);
    }
    console.error("delete product failed", err);
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