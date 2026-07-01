import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  Package,
  ShoppingCart,
  TrendingUp,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { daysUntil, formatDate, formatPrice } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { SectionCard } from "@/components/ui/section-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Pill } from "@/components/ui/pill";
import type { Tone } from "@/components/ui/pill";

export const dynamic = "force-dynamic";

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

type SlimProduct = {
  id: string;
  name: string;
  brand: string | null;
  spec: string | null;
  stock: number;
  lowStockThreshold: number;
  expiryDate: Date | string | null;
};

export default async function DashboardPage() {
  const today = startOfToday();

  const [todaySalesAgg, todayCount, allProducts, todaySalesList, productCount] =
    await Promise.all([
      prisma.sale.aggregate({
        where: { soldAt: { gte: today } },
        _sum: { totalAmount: true, totalProfit: true },
      }),
      prisma.sale.count({ where: { soldAt: { gte: today } } }),
      prisma.product.findMany({
        select: {
          id: true,
          name: true,
          category: true,
          brand: true,
          spec: true,
          stock: true,
          lowStockThreshold: true,
          costPrice: true,
          salePrice: true,
          expiryDate: true,
        },
        take: 1000,
        orderBy: { name: "asc" },
      }),
      prisma.sale.findMany({
        where: { soldAt: { gte: today } },
        orderBy: { soldAt: "desc" },
        take: 5,
        include: {
          items: { select: { product: { select: { name: true } } } },
        },
      }),
      prisma.product.count(),
    ]);

  // 内存分类(数据量 < 1000 SKU,在内存里更直观)
  const lowStock = allProducts.filter(
    (p) => p.stock <= p.lowStockThreshold,
  );
  const expired = allProducts.filter((p) => {
    const d = daysUntil(p.expiryDate);
    return d !== null && d < 0;
  });
  const expiring7 = allProducts.filter((p) => {
    const d = daysUntil(p.expiryDate);
    return d !== null && d >= 0 && d <= 7;
  });
  const expiring15 = allProducts.filter((p) => {
    const d = daysUntil(p.expiryDate);
    return d !== null && d > 7 && d <= 15;
  });
  const expiring30 = allProducts.filter((p) => {
    const d = daysUntil(p.expiryDate);
    return d !== null && d > 15 && d <= 30;
  });

  const inventoryCost = allProducts.reduce(
    (s, p) => s + Number(p.costPrice.toString()) * p.stock,
    0,
  );
  const inventoryRetail = allProducts.reduce(
    (s, p) => s + Number(p.salePrice.toString()) * p.stock,
    0,
  );

  const todayAmount = Number(todaySalesAgg._sum.totalAmount?.toString() ?? 0);
  const todayProfit = Number(todaySalesAgg._sum.totalProfit?.toString() ?? 0);
  const todayMargin =
    todayAmount > 0 ? (todayProfit / todayAmount) * 100 : 0;

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-6 py-8">
      <PageHeader
        title="经营看板"
        description={`${formatDate(today).replace(/-/g, "/")} · 共 ${productCount} 个 SKU`}
      />

      {/* KPI */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label="今日销售"
          value={formatPrice(todayAmount)}
          sub={`${todayCount} 单`}
          icon={<TrendingUp className="h-4 w-4" />}
          accent={todayAmount > 0 ? "positive" : "muted"}
        />
        <StatCard
          label="今日毛利"
          value={formatPrice(todayProfit)}
          sub={todayAmount > 0 ? `毛利率 ${todayMargin.toFixed(1)}%` : "—"}
          icon={<TrendingUp className="h-4 w-4" />}
          accent={todayProfit > 0 ? "positive" : "muted"}
        />
        <StatCard
          label="库存总成本"
          value={`¥${Math.round(inventoryCost).toLocaleString()}`}
          sub={`按进价计 · ${productCount} 个 SKU`}
          icon={<Package className="h-4 w-4" />}
        />
        <StatCard
          label="库存总价值"
          value={`¥${Math.round(inventoryRetail).toLocaleString()}`}
          sub="按售价计 · 潜在收入"
          icon={<Package className="h-4 w-4" />}
          accent="muted"
        />
      </div>

      {/* 低库存 + 临期 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard
          title="低库存提醒"
          icon={<AlertTriangle className="h-4 w-4" />}
          count={lowStock.length}
          countTone="warning"
          headerAction={{
            label: "去管理商品",
            href: "/products",
            trailingIcon: <ArrowRight className="h-3 w-3" />,
          }}
        >
          {lowStock.length === 0 ? (
            <EmptyState
              title="所有商品库存充足"
              hint="库存数都高于阈值,继续保持。"
              className="rounded-none border-0"
            />
          ) : (
            <ul className="divide-y divide-line">
              {lowStock.slice(0, 8).map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/products/${p.id}/edit`}
                    className="flex items-center justify-between px-5 py-3 transition-colors hover:bg-surface-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-ink">
                        {p.name}
                      </div>
                      <div className="mt-0.5 truncate text-xs text-ink-3">
                        {[p.brand, p.spec].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                    <div className="ml-3 text-right">
                      <Pill tone="warning" variant="soft">
                        {p.stock} 件
                      </Pill>
                      <div className="mt-1 text-[11px] text-ink-3">
                        阈值 {p.lowStockThreshold}
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {lowStock.length > 8 && (
            <div className="border-t border-line px-5 py-2 text-xs text-ink-2">
              还有 {lowStock.length - 8} 个低库存商品…
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="临期提醒"
          icon={<CalendarClock className="h-4 w-4" />}
          count={expired.length + expiring7.length + expiring15.length + expiring30.length}
          countTone="danger"
          headerAction={{
            label: "去管理商品",
            href: "/products",
            trailingIcon: <ArrowRight className="h-3 w-3" />,
          }}
        >
          {expired.length + expiring7.length + expiring15.length + expiring30.length === 0 ? (
            <EmptyState
              title="近期没有临期或过期商品"
              hint="所有 SKU 都在有效期内,继续保持。"
              className="rounded-none border-0"
            />
          ) : (
            <>
              {expired.length > 0 && (
                <ExpiryBucket
                  label="已过期"
                  tone="danger"
                  items={expired.slice(0, 5)}
                  renderRight={(p) => {
                    const d = daysUntil(p.expiryDate);
                    return `${d != null ? -d : 0} 天`;
                  }}
                />
              )}
              {expiring7.length > 0 && (
                <ExpiryBucket
                  label="7 天内到期"
                  tone="warning"
                  items={expiring7.slice(0, 5)}
                  renderRight={(p) => `${daysUntil(p.expiryDate) ?? 0} 天`}
                />
              )}
              {expiring15.length > 0 && (
                <ExpiryBucket
                  label="15 天内到期"
                  tone="warning"
                  items={expiring15.slice(0, 5)}
                  renderRight={(p) => `${daysUntil(p.expiryDate) ?? 0} 天`}
                />
              )}
              {expiring30.length > 0 && (
                <ExpiryBucket
                  label="30 天内到期"
                  tone="neutral"
                  items={expiring30.slice(0, 5)}
                  renderRight={(p) => `${daysUntil(p.expiryDate) ?? 0} 天`}
                />
              )}
            </>
          )}
        </SectionCard>
      </div>

      {/* 今日销售 */}
      <SectionCard
        title="今日销售"
        icon={<ShoppingCart className="h-4 w-4" />}
        count={todayCount}
        headerAction={{
          label: "查看全部",
          href: "/sales",
          trailingIcon: <ArrowRight className="h-3 w-3" />,
        }}
      >
        {todaySalesList.length === 0 ? (
          <EmptyState
            title="今天还没有销售"
            hint={
              <Link
                href="/sales/new"
                className="font-medium text-accent underline underline-offset-4 hover:text-accent-hover"
              >
                开始第一笔
              </Link>
            }
            className="rounded-none border-0"
          />
        ) : (
          <ul className="divide-y divide-line">
            {todaySalesList.map((s) => {
              const preview = s.items[0]?.product.name ?? "(空)";
              const more =
                s.items.length > 1 ? ` 等 ${s.items.length} 项` : "";
              const profit = Number(s.totalProfit.toString());
              return (
                <li key={s.id}>
                  <Link
                    href={`/sales/${s.id}`}
                    className="flex items-center justify-between px-5 py-3 transition-colors hover:bg-surface-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-ink">
                        {preview}
                        {more && <span className="text-ink-3">{more}</span>}
                      </div>
                      <div className="mt-0.5 text-xs text-ink-3 tnum">
                        {new Date(s.soldAt).toTimeString().slice(0, 5)} ·{" "}
                        {s.itemCount} 件
                      </div>
                    </div>
                    <div className="ml-3 text-right">
                      <div className="font-serif text-base font-semibold tnum text-ink">
                        {formatPrice(s.totalAmount)}
                      </div>
                      <div
                        className={`mt-0.5 text-xs tnum ${profit >= 0 ? "text-positive" : "text-danger"}`}
                      >
                        +{formatPrice(s.totalProfit)}
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}

function ExpiryBucket({
  label,
  tone,
  items,
  renderRight,
}: {
  label: string;
  tone: Tone;
  items: SlimProduct[];
  renderRight: (p: SlimProduct) => string;
}) {
  return (
    <div>
      <div className="border-y border-line bg-surface-2/60 px-5 py-1.5 text-xs font-medium text-ink-2">
        {label}
      </div>
      <ul className="divide-y divide-line">
        {items.map((p) => {
          const meta = [p.brand, p.spec].filter(Boolean).join(" · ");
          return (
            <li key={p.id}>
              <Link
                href={`/products/${p.id}/edit`}
                className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-surface-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-ink">
                    {p.name}
                  </div>
                  {meta && (
                    <div className="mt-0.5 truncate text-xs text-ink-3">
                      {meta}
                    </div>
                  )}
                </div>
                <Pill tone={tone} variant="soft">
                  {renderRight(p)}
                </Pill>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
