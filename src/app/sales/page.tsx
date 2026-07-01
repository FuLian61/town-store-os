import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { formatDateTime, formatPrice } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Receipt } from "lucide-react";

type SearchParams = Promise<{
  from?: string;
  to?: string;
}>;

function parseDateParam(s: string | undefined): Date | undefined {
  if (!s) return undefined;
  // 接受 YYYY-MM-DD 或 ISO datetime
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return new Date(`${s}T00:00:00Z`);
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export default async function SalesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const from = parseDateParam(sp.from);
  const to = parseDateParam(sp.to);

  const where: Prisma.SaleWhereInput = {};
  if (from || to) {
    where.soldAt = {};
    if (from) where.soldAt.gte = from;
    if (to) {
      // to 是 YYYY-MM-DD 时，包含当天结束
      const isDateOnly = sp.to && /^\d{4}-\d{2}-\d{2}$/.test(sp.to);
      where.soldAt.lte = isDateOnly
        ? new Date(`${sp.to}T23:59:59.999Z`)
        : to;
    }
  }

  const sales = await prisma.sale.findMany({
    where,
    orderBy: { soldAt: "desc" },
    take: 200,
    include: {
      items: {
        include: {
          product: {
            select: { id: true, name: true, spec: true, brand: true },
          },
        },
      },
    },
  });

  // 汇总统计（仅当前筛选范围）
  const totalAmount = sales.reduce(
    (s, x) => s + Number(x.totalAmount.toString()),
    0,
  );
  const totalProfit = sales.reduce(
    (s, x) => s + Number(x.totalProfit.toString()),
    0,
  );
  const margin =
    totalAmount > 0 ? (totalProfit / totalAmount) * 100 : 0;
  const hasFilter = Boolean(from) || Boolean(to);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-6 py-8">
      <PageHeader
        title="销售记录"
        description={`共 ${sales.length} 条`}
        actions={
          <Link
            href="/sales/new"
            className="inline-flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-sm font-medium text-surface transition-colors hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-accent/40"
          >
            <Plus className="h-4 w-4" />
            新建销售
          </Link>
        }
      />

      <form
        action="/sales"
        method="GET"
        className="flex flex-wrap items-end gap-3 rounded-lg border border-line bg-surface p-4"
      >
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-ink-2">开始日期</span>
          <input
            type="date"
            name="from"
            defaultValue={from ? from.toISOString().slice(0, 10) : ""}
            className="rounded-md border border-line-strong bg-surface px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-ink-2">结束日期</span>
          <input
            type="date"
            name="to"
            defaultValue={to ? to.toISOString().slice(0, 10) : ""}
            className="rounded-md border border-line-strong bg-surface px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
          />
        </label>
        <button
          type="submit"
          className="rounded-md bg-ink px-4 py-2 text-sm font-medium text-surface transition-colors hover:bg-ink-2 focus:outline-none focus:ring-2 focus:ring-ink/30"
        >
          筛选
        </button>
        {hasFilter && (
          <Link
            href="/sales"
            className="rounded-md border border-line-strong bg-surface px-3 py-2 text-sm transition-colors hover:bg-surface-2"
          >
            清空
          </Link>
        )}
      </form>

      {sales.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="销售总额" value={formatPrice(totalAmount)} />
          <StatCard
            label="总毛利"
            value={formatPrice(totalProfit)}
            accent={totalProfit >= 0 ? "positive" : "danger"}
          />
          <StatCard label="平均毛利率" value={`${margin.toFixed(1)}%`} />
          <StatCard
            label="单数"
            value={String(sales.length)}
            accent="muted"
          />
        </div>
      )}

      {sales.length === 0 ? (
        <EmptyState
          icon={<Receipt className="h-8 w-8" />}
          title={
            hasFilter
              ? "所选时间段没有销售记录"
              : "还没有销售记录"
          }
          hint={
            hasFilter
              ? "试着放宽日期范围。"
              : "点击右上角「新建销售」开始第一笔。"
          }
          action={
            hasFilter ? undefined : (
              <Link
                href="/sales/new"
                className="inline-flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-sm font-medium text-surface transition-colors hover:bg-accent-hover"
              >
                <Plus className="h-4 w-4" />
                新建销售
              </Link>
            )
          }
        />
      ) : (
        <SectionCard bodyClassName="overflow-x-auto">
          <table className="min-w-full divide-y divide-line text-sm">
            <thead className="bg-surface-2/50 text-xs uppercase tracking-wider text-ink-3">
              <tr>
                <th className="px-5 py-3 text-left font-medium">销售时间</th>
                <th className="px-5 py-3 text-left font-medium">商品</th>
                <th className="px-5 py-3 text-right font-medium">件数</th>
                <th className="px-5 py-3 text-right font-medium">销售总额</th>
                <th className="px-5 py-3 text-right font-medium">毛利</th>
                <th className="px-5 py-3 text-right font-medium">毛利率</th>
                <th className="px-5 py-3 text-left font-medium">备注</th>
                <th className="px-5 py-3 text-right font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {sales.map((s) => {
                const sa = Number(s.totalAmount.toString());
                const sp = Number(s.totalProfit.toString());
                const sm = sa > 0 ? (sp / sa) * 100 : 0;
                return (
                  <tr
                    key={s.id}
                    className="transition-colors hover:bg-surface-2"
                  >
                    <td className="px-5 py-3 text-ink-2 tnum">
                      {formatDateTime(s.soldAt)}
                    </td>
                    <td className="px-5 py-3">
                      <div className="text-ink">
                        {s.items[0]?.product.name ?? "(空)"}
                        {s.items.length > 1 && (
                          <span className="text-ink-3">
                            {" "}
                            等 {s.items.length} 项
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right text-ink-2 tnum">
                      {s.itemCount}
                    </td>
                    <td className="px-5 py-3 text-right font-serif font-semibold text-ink tnum">
                      {formatPrice(s.totalAmount)}
                    </td>
                    <td
                      className={`px-5 py-3 text-right tnum ${
                        sp >= 0 ? "text-positive" : "text-danger"
                      }`}
                    >
                      {formatPrice(s.totalProfit)}
                    </td>
                    <td className="px-5 py-3 text-right text-ink-3 tnum">
                      {sm.toFixed(1)}%
                    </td>
                    <td className="max-w-[200px] truncate px-5 py-3 text-ink-2">
                      {s.note ?? "—"}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link
                        href={`/sales/${s.id}`}
                        className="inline-flex items-center rounded-md p-1 text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
                        aria-label="查看详情"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </SectionCard>
      )}
    </div>
  );
}
