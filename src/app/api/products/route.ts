import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  apiError,
  handleZodError,
  prismaErrorStatus,
} from "@/lib/api";
import {
  createProductSchema,
  listProductsQuerySchema,
} from "@/lib/validators/product";

// 列表查询：name/barcode/brand 模糊匹配，可选 category 精确匹配
export async function GET(request: NextRequest) {
  const parsed = listProductsQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  );
  if (!parsed.success) return handleZodError(parsed.error);

  const { q, category } = parsed.data;
  const where: Prisma.ProductWhereInput = {};
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { barcode: { contains: q, mode: "insensitive" } },
      { brand: { contains: q, mode: "insensitive" } },
    ];
  }
  if (category) where.category = category;

  const products = await prisma.product.findMany({
    where,
    orderBy: [{ updatedAt: "desc" }],
    take: 200,
  });
  return NextResponse.json({ products });
}

// 创建商品：写入主记录 + 初始库存流水（如果 stock > 0）
export async function POST(request: NextRequest) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return apiError("请求体不是合法 JSON", 400, "INVALID_JSON");
  }

  const parsed = createProductSchema.safeParse(json);
  if (!parsed.success) return handleZodError(parsed.error);

  const input = parsed.data;

  try {
    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({ data: input });
      if (created.stock > 0) {
        await tx.stockMovement.create({
          data: {
            productId: created.id,
            type: "INBOUND",
            quantity: created.stock,
            beforeStock: 0,
            afterStock: created.stock,
            referenceType: "manual",
            note: "商品首次入库",
          },
        });
      }
      return created;
    });
    return NextResponse.json({ product }, { status: 201 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      const status = prismaErrorStatus(err.code);
      if (status === 409) {
        return apiError("条码已存在", 409, "DUPLICATE_BARCODE");
      }
      if (status) return apiError(err.message, status, err.code);
    }
    console.error("create product failed", err);
    return apiError("服务器内部错误", 500, "INTERNAL_ERROR");
  }
}