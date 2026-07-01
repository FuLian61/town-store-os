import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { SalePos, type PosProduct } from "@/components/sale-pos";

export const dynamic = "force-dynamic";

export default async function NewSalePage() {
  // 只加载可售商品，按商品名排序
  // 库存上限取 200，后续可在 search params 里支持搜索
  const products = await prisma.product.findMany({
    where: { stock: { gt: 0 } },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      brand: true,
      spec: true,
      costPrice: true,
      salePrice: true,
      stock: true,
    },
    take: 200,
  });

  const posProducts: PosProduct[] = products.map((p) => ({
    id: p.id,
    name: p.name,
    brand: p.brand,
    spec: p.spec,
    costPrice: p.costPrice.toString(),
    salePrice: p.salePrice.toString(),
    stock: p.stock,
  }));

  return (
    <div className="mx-auto max-w-7xl p-6 space-y-6">
      <div>
        <Link
          href="/sales"
          className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          <ChevronLeft className="h-4 w-4" />
          返回销售列表
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          新建销售
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          点击左侧商品加入购物车，调整数量后确认销售。
        </p>
      </div>

      {posProducts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-200 p-12 text-center text-sm text-zinc-500 dark:border-zinc-800">
          暂无有库存的商品，先去
          <Link
            href="/products/new"
            className="mx-1 underline underline-offset-2 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            录入商品
          </Link>
          再来开单。
        </div>
      ) : (
        <SalePos products={posProducts} />
      )}
    </div>
  );
}