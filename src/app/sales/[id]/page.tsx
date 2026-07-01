import Link from "next/link";
import { notFound } from "next/navigation";
import { History, Receipt } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatDateTime, formatPrice } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { StatCard } from "@/components/ui/stat-card";
import { Pill } from "@/components/ui/pill";

type Params = Promise<{ id: string }>;

export default async function SaleDetailPage({
  params,
}: {
  params: Params;
}) {
  const { id } = await params;

  const sale = await prisma.sale.findUnique({
    where: { id },
    include: {
      items: {
        orderBy: { createdAt: "asc" },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              brand: true,
              spec: true,
              shelfLocation: true,
            },
          },
        },
      },
    },
  });
  if (!sale) notFound();

  const movements = await prisma.stockMovement.findMany({
    where: { referenceType: "sale", referenceId: id },
    orderBy: { createdAt: "asc" },
    include: {
      product: { select: { name: true } },
    },
  });

  const totalAmount = Number(sale.totalAmount.toString());
  const totalProfit = Number(sale.totalProfit.toString());
  const totalCost = Number(sale.totalCost.toString());
  const margin =
    totalAmount > 0 ? (totalProfit / totalAmount) * 100 : 0;

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-6 py-8">
      <PageHeader
        title="销售单"
        description={formatDateTime(sale.soldAt)}
        backHref="/sales"
        backLabel="返回销售列表"
        actions={
          <Link
            href="/sales/new"
            className="inline-flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-sm font-medium text-surface transition-colors hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-accent/40"
          >
            再开一单 →
          </Link>
        }
      />

      {/* 销售单头部:账本式摘要 */}
      <SectionCard
        title="销售单"
        icon={<Receipt className="h-4 w-4" />}
        headerAction={
          <span className="font-mono text-[10px] text-ink-3">
            {sale.id}
          </span>
        }
        footer={
          sale.note ? (
            <span>
              <span className="text-ink-3">备注 · </span>
              <span className="text-ink-2">{sale.note}</span>
            </span>
          ) : undefined
        }
      >
        <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-3">
          <StatCard label="销售总额" value={formatPrice(totalAmount)} />
          <StatCard label="成本" value={formatPrice(totalCost)} accent="muted" />
          <StatCard
            label={`毛利（毛利率 ${margin.toFixed(1)}%）`}
            value={formatPrice(totalProfit)}
            accent={totalProfit >= 0 ? "positive" : "danger"}
          />
        </div>
      </SectionCard>

      {/* 商品明细 */}
      <SectionCard
        title="商品明细"
        icon={<Receipt className="h-4 w-4" />}
        count={sale.items.length}
        countTone="neutral"
        headerAction={
          <span className="text-xs text-ink-3">
            共 {sale.itemCount} 件
          </span>
        }
        bodyClassName="overflow-x-auto"
      >
        <table className="min-w-full divide-y divide-line text-sm">
          <thead className="bg-surface-2/50 text-xs uppercase tracking-wider text-ink-3">
            <tr>
              <th className="px-5 py-3 text-left font-medium">商品</th>
              <th className="px-5 py-3 text-right font-medium">售价</th>
              <th className="px-5 py-3 text-right font-medium">数量</th>
              <th className="px-5 py-3 text-right font-medium">小计</th>
              <th className="px-5 py-3 text-right font-medium">毛利</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {sale.items.map((it) => (
              <tr key={it.id} className="transition-colors hover:bg-surface-2">
                <td className="px-5 py-3">
                  <Link
                    href={`/products/${it.product.id}/edit`}
                    className="font-medium text-ink transition-colors hover:text-accent"
                  >
                    {it.product.name}
                  </Link>
                  {(it.product.brand || it.product.spec) && (
                    <div className="mt-0.5 text-xs text-ink-3">
                      {[it.product.brand, it.product.spec]
                        .filter(Boolean)
                        .join(" · ")}
                      {it.product.shelfLocation && (
                        <span className="ml-2 font-mono text-[10px]">
                          货架 {it.product.shelfLocation}
                        </span>
                      )}
                    </div>
                  )}
                </td>
                <td className="px-5 py-3 text-right text-ink-2 tnum">
                  {formatPrice(it.salePrice)}
                </td>
                <td className="px-5 py-3 text-right text-ink-2 tnum">
                  ×{it.quantity}
                </td>
                <td className="px-5 py-3 text-right font-serif font-medium text-ink tnum">
                  {formatPrice(it.subtotal)}
                </td>
                <td
                  className={`px-5 py-3 text-right tnum ${
                    Number(it.profit.toString()) >= 0
                      ? "text-positive"
                      : "text-danger"
                  }`}
                >
                  {formatPrice(it.profit)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-line-strong bg-surface-2/40 tnum">
            <tr>
              <td colSpan={3} className="px-5 py-3 text-right font-medium text-ink">
                合计
              </td>
              <td className="px-5 py-3 text-right font-serif font-semibold text-ink">
                {formatPrice(sale.totalAmount)}
              </td>
              <td className="px-5 py-3 text-right font-semibold text-positive">
                {formatPrice(sale.totalProfit)}
              </td>
            </tr>
          </tfoot>
        </table>
      </SectionCard>

      {/* 库存流水 */}
      {movements.length > 0 && (
        <SectionCard
          title="库存变化"
          icon={<History className="h-4 w-4" />}
          count={movements.length}
          bodyClassName="overflow-x-auto"
        >
          <table className="min-w-full divide-y divide-line text-sm">
            <thead className="bg-surface-2/50 text-xs uppercase tracking-wider text-ink-3">
              <tr>
                <th className="px-5 py-3 text-left font-medium">商品</th>
                <th className="px-5 py-3 text-left font-medium">类型</th>
                <th className="px-5 py-3 text-right font-medium">变化</th>
                <th className="px-5 py-3 text-right font-medium">变更前</th>
                <th className="px-5 py-3 text-right font-medium">变更后</th>
                <th className="px-5 py-3 text-left font-medium">时间</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {movements.map((m) => (
                <tr key={m.id} className="transition-colors hover:bg-surface-2">
                  <td className="px-5 py-3">{m.product.name}</td>
                  <td className="px-5 py-3">
                    <Pill tone="accent" variant="soft">
                      销售出库
                    </Pill>
                  </td>
                  <td className="px-5 py-3 text-right font-medium text-danger tnum">
                    {m.quantity}
                  </td>
                  <td className="px-5 py-3 text-right text-ink-2 tnum">
                    {m.beforeStock}
                  </td>
                  <td className="px-5 py-3 text-right text-ink tnum">
                    {m.afterStock}
                  </td>
                  <td className="px-5 py-3 text-xs text-ink-3 tnum">
                    {formatDateTime(m.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </SectionCard>
      )}
    </div>
  );
}
