import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatDateTime, formatPrice } from "@/lib/format";

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

  return (
    <div className="mx-auto max-w-6xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">销售记录</h1>
          <p className="text-sm text-zinc-500 mt-1">共 {sales.length} 条</p>
        </div>
        <Link
          href="/sales/new"
          className="inline-flex items-center gap-1.5 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          <Plus className="h-4 w-4" />
          新建销售
        </Link>
      </div>

      <form
        action="/sales"
        method="GET"
        className="flex flex-wrap items-end gap-3"
      >
        <label className="block space-y-1.5">
          <span className="text-xs text-zinc-500">开始日期</span>
          <input
            type="date"
            name="from"
            defaultValue={
              from ? from.toISOString().slice(0, 10) : ""
            }
            className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs text-zinc-500">结束日期</span>
          <input
            type="date"
            name="to"
            defaultValue={to ? to.toISOString().slice(0, 10) : ""}
            className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950"
          />
        </label>
        <button
          type="submit"
          className="rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900"
        >
          筛选
        </button>
        {(from || to) && (
          <Link
            href="/sales"
            className="rounded-md px-3 py-2 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            清空
          </Link>
        )}
      </form>

      {sales.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="销售总额" value={formatPrice(totalAmount)} />
          <Stat label="总毛利" value={formatPrice(totalProfit)} />
          <Stat label="平均毛利率" value={`${margin.toFixed(1)}%`} />
          <Stat
            label="单数"
            value={String(sales.length)}
            muted
          />
        </div>
      )}

      {sales.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-200 p-12 text-center text-sm text-zinc-500 dark:border-zinc-800">
          {from || to ? "所选时间段没有销售记录" : "还没有销售，点击右上角开始第一笔销售"}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wider text-zinc-500 dark:bg-zinc-900">
              <tr>
                <th className="px-4 py-3 font-medium">销售时间</th>
                <th className="px-4 py-3 font-medium">商品</th>
                <th className="px-4 py-3 font-medium text-right">件数</th>
                <th className="px-4 py-3 font-medium text-right">销售总额</th>
                <th className="px-4 py-3 font-medium text-right">毛利</th>
                <th className="px-4 py-3 font-medium text-right">毛利率</th>
                <th className="px-4 py-3 font-medium">备注</th>
                <th className="px-4 py-3 font-medium w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {sales.map((s) => {
                const sa = Number(s.totalAmount.toString());
                const sp = Number(s.totalProfit.toString());
                const sm = sa > 0 ? (sp / sa) * 100 : 0;
                return (
                  <tr
                    key={s.id}
                    className="bg-white hover:bg-zinc-50 dark:bg-zinc-950 dark:hover:bg-zinc-900"
                  >
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400 tabular-nums">
                      {formatDateTime(s.soldAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-zinc-900 dark:text-zinc-100">
                        {s.items[0]?.product.name ?? "(空)"}
                        {s.items.length > 1 && (
                          <span className="text-zinc-500">
                            {" "}等 {s.items.length} 项
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {s.itemCount}
                    </td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">
                      {formatPrice(s.totalAmount)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <span
                        className={
                          sp >= 0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-red-600"
                        }
                      >
                        {formatPrice(s.totalProfit)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-zinc-600 dark:text-zinc-400">
                      {sm.toFixed(1)}%
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400 max-w-[200px] truncate">
                      {s.note ?? "-"}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/sales/${s.id}`}
                        className="inline-flex items-center text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
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
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  muted,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="text-xs text-zinc-500">{label}</div>
      <div
        className={`mt-1 text-lg font-semibold tabular-nums ${muted ? "text-zinc-500" : ""}`}
      >
        {value}
      </div>
    </div>
  );
}