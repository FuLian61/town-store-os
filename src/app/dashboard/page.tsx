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
import {
  daysUntil,
  formatDate,
  formatPrice,
} from "@/lib/format";

export const dynamic = "force-dynamic";

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

export default async function DashboardPage() {
  const today = startOfToday();
  const in7 = addDays(today, 7);
  const in15 = addDays(today, 15);
  const in30 = addDays(today, 30);

  // 并行拉数据
  const [
    todaySalesAgg,
    todayCount,
    allProducts,
    todaySalesList,
    productCount,
    lowStockCount,
    expiringSoonCount,
    expiredCount,
  ] = await Promise.all([
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
        items: {
          select: { product: { select: { name: true } } },
        },
      },
    }),
    prisma.product.count(),
    // placeholder，下面再算
    Promise.resolve(0),
    Promise.resolve(0),
    Promise.resolve(0),
  ]);

  // 在内存里分类（数据量小，< 1000 SKU）
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

  // 库存总成本
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
    <div className="mx-auto max-w-6xl p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">经营看板</h1>
        <p className="text-sm text-zinc-500 mt-1">
          {formatDate(today)} · 商品总数 {productCount}
        </p>
      </div>

      {/* KPI 卡片 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard
          label="今日销售"
          value={formatPrice(todayAmount)}
          sub={`${todayCount} 单`}
          icon={<TrendingUp className="h-4 w-4" />}
          accent={
            todayAmount > 0 ? "emerald" : todayCount === 0 ? "muted" : null
          }
        />
        <KpiCard
          label="今日毛利"
          value={formatPrice(todayProfit)}
          sub={
            todayAmount > 0
              ? `毛利率 ${todayMargin.toFixed(1)}%`
              : "—"
          }
          icon={<TrendingUp className="h-4 w-4" />}
          accent={todayProfit > 0 ? "emerald" : null}
        />
        <KpiCard
          label="库存总成本"
          value={formatPrice(inventoryCost)}
          sub={`按进价计 ${productCount} 个 SKU`}
          icon={<Package className="h-4 w-4" />}
        />
        <KpiCard
          label="库存总价值"
          value={formatPrice(inventoryRetail)}
          sub={`按售价计 · 潜在收入`}
          icon={<Package className="h-4 w-4" />}
          muted
        />
      </div>

      {/* 低库存 + 临期 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <AlertSection
          title="低库存提醒"
          icon={<AlertTriangle className="h-4 w-4" />}
          count={lowStock.length}
          link="/products"
          linkLabel="去管理商品"
          tone="amber"
          emptyText="所有商品库存充足"
        >
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {lowStock.slice(0, 8).map((p) => (
              <li key={p.id}>
                <Link
                  href={`/products/${p.id}/edit`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                      {p.name}
                    </div>
                    <div className="text-xs text-zinc-500 mt-0.5">
                      {[p.brand, p.spec].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  <div className="text-right ml-3">
                    <div className="text-sm font-medium text-amber-600 dark:text-amber-400 tabular-nums">
                      {p.stock}
                    </div>
                    <div className="text-xs text-zinc-400">
                      阈值 {p.lowStockThreshold}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          {lowStock.length > 8 && (
            <div className="border-t border-zinc-200 px-4 py-2 text-xs text-zinc-500 dark:border-zinc-800">
              还有 {lowStock.length - 8} 个低库存商品…
            </div>
          )}
        </AlertSection>

        <AlertSection
          title="临期提醒"
          icon={<CalendarClock className="h-4 w-4" />}
          count={
            expired.length +
            expiring7.length +
            expiring15.length +
            expiring30.length
          }
          link="/products"
          linkLabel="去管理商品"
          tone="red"
          emptyText="近期没有临期或过期商品"
        >
          {expired.length > 0 && (
            <BucketGroup label="已过期" tone="red">
              {expired.slice(0, 5).map((p) => (
                <ProductAlertRow
                  key={p.id}
                  id={p.id}
                  name={p.name}
                  meta={[p.brand, p.spec].filter(Boolean).join(" · ")}
                  right={`${-daysUntil(p.expiryDate)!} 天`}
                />
              ))}
            </BucketGroup>
          )}
          {expiring7.length > 0 && (
            <BucketGroup label="7 天内到期" tone="amber">
              {expiring7.slice(0, 5).map((p) => (
                <ProductAlertRow
                  key={p.id}
                  id={p.id}
                  name={p.name}
                  meta={[p.brand, p.spec].filter(Boolean).join(" · ")}
                  right={`${daysUntil(p.expiryDate)} 天`}
                />
              ))}
            </BucketGroup>
          )}
          {expiring15.length > 0 && (
            <BucketGroup label="15 天内到期" tone="amber">
              {expiring15.slice(0, 5).map((p) => (
                <ProductAlertRow
                  key={p.id}
                  id={p.id}
                  name={p.name}
                  meta={[p.brand, p.spec].filter(Boolean).join(" · ")}
                  right={`${daysUntil(p.expiryDate)} 天`}
                />
              ))}
            </BucketGroup>
          )}
          {expiring30.length > 0 && (
            <BucketGroup label="30 天内到期" tone="muted">
              {expiring30.slice(0, 5).map((p) => (
                <ProductAlertRow
                  key={p.id}
                  id={p.id}
                  name={p.name}
                  meta={[p.brand, p.spec].filter(Boolean).join(" · ")}
                  right={`${daysUntil(p.expiryDate)} 天`}
                />
              ))}
            </BucketGroup>
          )}
        </AlertSection>
      </div>

      {/* 今日销售 */}
      <section className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 text-zinc-500" />
            <span className="font-medium text-sm">今日销售</span>
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
              {todayCount} 单
            </span>
          </div>
          <Link
            href="/sales"
            className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            查看全部
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        {todaySalesList.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-zinc-400">
            今天还没有销售
            <Link
              href="/sales/new"
              className="ml-2 underline underline-offset-2 hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              开始第一笔 →
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {todaySalesList.map((s) => {
              const preview =
                s.items[0]?.product.name ?? "(空)";
              const more = s.items.length > 1 ? ` 等 ${s.items.length} 项` : "";
              return (
                <li key={s.id}>
                  <Link
                    href={`/sales/${s.id}`}
                    className="flex items-center justify-between px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                        {preview}
                        {more && (
                          <span className="text-zinc-500">{more}</span>
                        )}
                      </div>
                      <div className="text-xs text-zinc-500 mt-0.5 tabular-nums">
                        {new Date(s.soldAt).toTimeString().slice(0, 5)} ·{" "}
                        {s.itemCount} 件
                      </div>
                    </div>
                    <div className="text-right ml-3">
                      <div className="text-sm font-medium tabular-nums">
                        {formatPrice(s.totalAmount)}
                      </div>
                      <div
                        className={`text-xs tabular-nums ${
                          Number(s.totalProfit.toString()) >= 0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-red-600"
                        }`}
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
      </section>
    </div>
  );
}

// === 小组件 ===

function KpiCard({
  label,
  value,
  sub,
  icon,
  accent,
  muted,
}: {
  label: string;
  value: string;
  sub?: string;
  icon?: React.ReactNode;
  accent?: "emerald" | "red" | "amber" | "muted" | null;
  muted?: boolean;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center justify-between text-zinc-500">
        <span className="text-xs">{label}</span>
        {icon}
      </div>
      <div
        className={`mt-2 text-2xl font-semibold tabular-nums ${
          muted || accent === "muted"
            ? "text-zinc-500"
            : accent === "emerald"
              ? "text-emerald-600 dark:text-emerald-400"
              : accent === "red"
                ? "text-red-600"
                : accent === "amber"
                  ? "text-amber-600 dark:text-amber-400"
                  : ""
        }`}
      >
        {value}
      </div>
      {sub && (
        <div className="mt-1 text-xs text-zinc-500 tabular-nums">{sub}</div>
      )}
    </div>
  );
}

function AlertSection({
  title,
  icon,
  count,
  link,
  linkLabel,
  tone,
  emptyText,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  count: number;
  link: string;
  linkLabel: string;
  tone: "red" | "amber";
  emptyText: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 overflow-hidden">
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <span
            className={
              tone === "red"
                ? "text-red-600"
                : "text-amber-600 dark:text-amber-400"
            }
          >
            {icon}
          </span>
          <span className="font-medium text-sm">{title}</span>
          {count > 0 && (
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                tone === "red"
                  ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                  : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200"
              }`}
            >
              {count}
            </span>
          )}
        </div>
        <Link
          href={link}
          className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          {linkLabel}
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      {count === 0 ? (
        <div className="px-4 py-12 text-center text-sm text-zinc-400">
          {emptyText}
        </div>
      ) : (
        children
      )}
    </section>
  );
}

function BucketGroup({
  label,
  tone,
  children,
}: {
  label: string;
  tone: "red" | "amber" | "muted";
  children: React.ReactNode;
}) {
  return (
    <div>
      <div
        className={`px-4 py-1.5 text-xs font-medium border-b border-zinc-200 dark:border-zinc-800 ${
          tone === "red"
            ? "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
            : tone === "amber"
              ? "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
              : "bg-zinc-50 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400"
        }`}
      >
        {label}
      </div>
      <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
        {children}
      </ul>
    </div>
  );
}

function ProductAlertRow({
  id,
  name,
  meta,
  right,
}: {
  id: string;
  name: string;
  meta: string;
  right: string;
}) {
  return (
    <li>
      <Link
        href={`/products/${id}/edit`}
        className="flex items-center justify-between px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900"
      >
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
            {name}
          </div>
          {meta && (
            <div className="text-xs text-zinc-500 mt-0.5 truncate">
              {meta}
            </div>
          )}
        </div>
        <div className="text-right ml-3">
          <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100 tabular-nums">
            {right}
          </div>
        </div>
      </Link>
    </li>
  );
}