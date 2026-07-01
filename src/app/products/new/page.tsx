import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { ProductForm } from "@/components/product-form";

export default async function NewProductPage() {
  const categories = await prisma.product.findMany({
    select: { category: true },
    distinct: ["category"],
    orderBy: { category: "asc" },
  });

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
          新建商品
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          填写商品信息后保存。如果初始库存大于 0，会自动写入一条入库流水。
        </p>
      </div>

      <ProductForm
        mode="create"
        categoryOptions={categories.map((c) => c.category)}
      />
    </div>
  );
}