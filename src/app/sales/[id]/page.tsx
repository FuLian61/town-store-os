import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, History } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatDateTime, formatPrice } from "@/lib/format";

type Params = Promise<{ id: string }>;

export default async function SaleDetailPage({ params }: { params: Params }) {
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
    <div className="mx-auto max-w-3xl p-6 space-y-6">
      <div>
        <Link
          href="/sales"
          className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          <ChevronLeft className="h-4 w-4" />
          返回销售列表
        </Link>
      </div>

      {/* 小票头部 */}
      <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-zinc-500">
              销售单
            </div>
            <div className="mt-1 font-mono text-xs text-zinc-400">
              {sale.id}
            </div>
            <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              {formatDateTime(sale.soldAt)}
            </div>
            {sale.note && (
              <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                备注：{sale.note}
              </div>
            )}
          </div>
          <Link
            href={`/sales/new`}
            className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            再开一单 →
          </Link>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-4 border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <div>
            <div className="text-xs text-zinc-500">销售总额</div>
            <div className="mt-1 text-xl font-semibold tabular-nums">
              {formatPrice(sale.totalAmount)}
            </div>
          </div>
          <div>
            <div className="text-xs text-zinc-500">成本</div>
            <div className="mt-1 text-xl font-semibold tabular-nums text-zinc-600 dark:text-zinc-400">
              {formatPrice(sale.totalCost)}
            </div>
          </div>
          <div>
            <div className="text-xs text-zinc-500">
              毛利（毛利率 {margin.toFixed(1)}%）
            </div>
            <div
              className={`mt-1 text-xl font-semibold tabular-nums ${
                totalProfit >= 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-red-600"
              }`}
            >
              {formatPrice(sale.totalProfit)}
            </div>
          </div>
        </div>
      </div>

      {/* 商品明细 */}
      <section>
        <h2 className="text-base font-semibold mb-3">
          商品明细
          <span className="ml-2 text-sm font-normal text-zinc-500">
            {sale.items.length} 项 / {sale.itemCount} 件
          </span>
        </h2>
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wider text-zinc-500 dark:bg-zinc-900">
              <tr>
                <th className="px-4 py-3 font-medium">商品</th>
                <th className="px-4 py-3 font-medium text-right">售价</th>
                <th className="px-4 py-3 font-medium text-right">数量</th>
                <th className="px-4 py-3 font-medium text-right">小计</th>
                <th className="px-4 py-3 font-medium text-right">毛利</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {sale.items.map((it) => (
                <tr
                  key={it.id}
                  className="bg-white dark:bg-zinc-950"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/products/${it.product.id}/edit`}
                      className="font-medium text-zinc-900 hover:underline dark:text-zinc-100"
                    >
                      {it.product.name}
                    </Link>
                    {(it.product.brand || it.product.spec) && (
                      <div className="text-xs text-zinc-500 mt-0.5">
                        {[it.product.brand, it.product.spec]
                          .filter(Boolean)
                          .join(" · ")}
                        {it.product.shelfLocation && (
                          <span className="ml-2">
                            · {it.product.shelfLocation}
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-zinc-600 dark:text-zinc-400">
                    {formatPrice(it.salePrice)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    ×{it.quantity}
                  </td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums">
                    {formatPrice(it.subtotal)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    <span
                      className={
                        Number(it.profit.toString()) >= 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-red-600"
                      }
                    >
                      {formatPrice(it.profit)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-zinc-300 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900">
              <tr>
                <td colSpan={3} className="px-4 py-3 text-right font-medium">
                  合计
                </td>
                <td className="px-4 py-3 text-right font-semibold tabular-nums">
                  {formatPrice(sale.totalAmount)}
                </td>
                <td className="px-4 py-3 text-right font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {formatPrice(sale.totalProfit)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {/* 库存流水 */}
      {movements.length > 0 && (
        <section>
          <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
            <History className="h-4 w-4" />
            库存变化
          </h2>
          <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wider text-zinc-500 dark:bg-zinc-900">
                <tr>
                  <th className="px-4 py-3 font-medium">商品</th>
                  <th className="px-4 py-3 font-medium">类型</th>
                  <th className="px-4 py-3 font-medium text-right">变化</th>
                  <th className="px-4 py-3 font-medium text-right">
                    变更前
                  </th>
                  <th className="px-4 py-3 font-medium text-right">
                    变更后
                  </th>
                  <th className="px-4 py-3 font-medium">时间</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {movements.map((m) => (
                  <tr key={m.id} className="bg-white dark:bg-zinc-950">
                    <td className="px-4 py-3">{m.product.name}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-950 dark:text-blue-200">
                        销售出库
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-red-600 dark:text-red-400 tabular-nums">
                      {m.quantity}
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-600 dark:text-zinc-400 tabular-nums">
                      {m.beforeStock}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {m.afterStock}
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-500 tabular-nums">
                      {formatDateTime(m.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}