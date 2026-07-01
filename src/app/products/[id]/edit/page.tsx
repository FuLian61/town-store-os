import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  ProductForm,
  type ProductFormValues,
} from "@/components/product-form";
import { PageHeader } from "@/components/ui/page-header";
import { DeleteProductButton } from "@/components/ui/delete-product-button";

type Params = Promise<{ id: string }>;

// 服务端把 Prisma 模型转成表单可用的字符串值。
// 字符串价格避免 JSON 序列化 Decimal 时的精度/类型问题。
function toFormValues(
  p: NonNullable<Awaited<ReturnType<typeof prisma.product.findUnique>>>,
): ProductFormValues {
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

export default async function EditProductPage({
  params,
}: {
  params: Params;
}) {
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
    <div className="mx-auto max-w-3xl space-y-8 px-6 py-8">
      <PageHeader
        title="编辑商品"
        description="修改库存会写入一条调整流水,方便追溯库存变化原因。"
        backHref="/products"
        backLabel="返回商品列表"
      />

      <ProductForm
        mode="edit"
        productId={id}
        initial={toFormValues(product)}
        categoryOptions={categories.map((c) => c.category)}
      />

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-3">
          危险操作
        </h2>
        <DeleteProductButton
          productId={product.id}
          productName={product.name}
        />
      </section>
    </div>
  );
}
