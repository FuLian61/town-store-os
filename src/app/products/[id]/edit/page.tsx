import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { ProductForm, type ProductFormValues } from "@/components/product-form";

type Params = Promise<{ id: string }>;

// 服务端把 Prisma 模型转成表单可用的字符串值。
// 字符串价格避免 JSON 序列化 Decimal 时的精度/类型问题。
function toFormValues(p: NonNullable<Awaited<ReturnType<typeof prisma.product.findUnique>>>): ProductFormValues {
  return {
    barcode: p.barcode ?? "",
    name: p.name,
    category: p.category,
    brand: p.brand ?? "",
    spec: p.spec ?? "",
    costPrice: p.costPrice.toString(),
    salePrice: p.salePrice.toString(),
    stock: String(p.stock),
    lowStockThreshold: String(p.lowStockThreshold),
    shelfLocation: p.shelfLocation ?? "",
    expiryDate: p.expiryDate
      ? new Date(p.expiryDate).toISOString().slice(0, 10)
      : "",
  };
}

export default async function EditProductPage({ params }: { params: Params }) {
  const { id } = await params;

  const [product, categories] = await Promise.all([
    prisma.product.findUnique({ where: { id } }),
    prisma.product.findMany({
      select: { category: true },
      distinct: ["category"],
      orderBy: { category: "asc" },
    }),
  ]);

  if (!product) notFound();

  return (
    <div className="mx-auto max-w-3xl p-6 space-y-6">
      <div>
        <Link
          href="/products"
          className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          <ChevronLeft className="h-4 w-4" />
          返回商品列表
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          编辑商品
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          修改库存会写入一条调整流水，方便追溯库存变化原因。
        </p>
      </div>

      <ProductForm
        mode="edit"
        productId={id}
        initial={toFormValues(product)}
        categoryOptions={categories.map((c) => c.category)}
      />
    </div>
  );
}