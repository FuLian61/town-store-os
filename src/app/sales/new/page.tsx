import Link from "next/link";
import { Package } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { SalePos, type PosProduct } from "@/components/sale-pos";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";

export const dynamic = "force-dynamic";

export default async function NewSalePage() {
  // 只加载可售商品，按商品名排序
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
    <div className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      <PageHeader
        title="新建销售"
        description="点击左侧商品加入购物车,调整数量后确认销售。"
        backHref="/sales"
        backLabel="返回销售列表"
      />

      {posProducts.length === 0 ? (
        <EmptyState
          icon={<Package className="h-8 w-8" />}
          title="暂无有库存的商品"
          hint={
            <>
              先去
              <Link
                href="/products/new"
                className="mx-1 font-medium text-accent underline underline-offset-4 hover:text-accent-hover"
              >
                录入商品
              </Link>
              再来开单。
            </>
          }
        />
      ) : (
        <SalePos products={posProducts} />
      )}
    </div>
  );
}
