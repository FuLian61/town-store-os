import { prisma } from "@/lib/prisma";
import { ProductForm } from "@/components/product-form";
import { PageHeader } from "@/components/ui/page-header";

export default async function NewProductPage() {
  const categories = await prisma.product.findMany({
    select: { category: true },
    distinct: ["category"],
    orderBy: { category: "asc" },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-6 py-8">
      <PageHeader
        title="新建商品"
        description="填写商品信息后保存。如果初始库存大于 0,会自动写入一条入库流水。"
        backHref="/products"
        backLabel="返回商品列表"
      />

      <ProductForm
        mode="create"
        categoryOptions={categories.map((c) => c.category)}
      />
    </div>
  );
}
