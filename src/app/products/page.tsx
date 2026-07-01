import Link from "next/link";
import { Package, Pencil, Plus, Search, X } from "lucide-react";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { daysUntil, formatDate } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Pill } from "@/components/ui/pill";

type SearchParams = Promise<{ q?: string; category?: string }>;

const PAGE_LIMIT = 200;

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() || undefined;
  const category = sp.category?.trim() || undefined;

  const where: Prisma.ProductWhereInput = {};
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { barcode: { contains: q, mode: "insensitive" } },
      { brand: { contains: q, mode: "insensitive" } },
    ];
  }
  if (category) where.category = category;

  const [products, categories] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }],
      take: PAGE_LIMIT,
    }),
    prisma.product.findMany({
      select: { category: true },
      distinct: ["category"],
      orderBy: { category: "asc" },
    }),
  ]);

  const hasFilter = Boolean(q) || Boolean(category);
  const isAtLimit = products.length >= PAGE_LIMIT;

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-6 py-8">
      <PageHeader
        title="商品管理"
        description={`共 ${products.length} 条${isAtLimit ? ` · 已达上限 ${PAGE_LIMIT}` : ""}`}
        actions={
          <Link
            href="/products/new"
            className="inline-flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-sm font-medium text-surface transition-colors hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-accent/40"
          >
            <Plus className="h-4 w-4" />
            新建商品
          </Link>
        }
      />

      <form
        action="/products"
        method="GET"
        className="flex flex-wrap items-end gap-3 rounded-lg border border-line bg-surface p-4"
      >
        <label className="block min-w-[240px] flex-1 space-y-1.5">
          <span className="text-xs font-medium text-ink-2">搜索</span>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3"
              aria-hidden
            />
            <input
              type="text"
              name="q"
              defaultValue={q ?? ""}
              placeholder="搜索商品名 / 条码 / 品牌"
              className="w-full rounded-md border border-line-strong bg-surface py-2 pl-9 pr-3 text-sm text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
            />
          </div>
        </label>
        <label className="block w-44 space-y-1.5">
          <span className="text-xs font-medium text-ink-2">分类</span>
          <select
            name="category"
            defaultValue={category ?? ""}
            className="w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
          >
            <option value="">全部分类</option>
            {categories.map((c) => (
              <option key={c.category} value={c.category}>
                {c.category}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="rounded-md bg-ink px-4 py-2 text-sm font-medium text-surface transition-colors hover:bg-ink-2 focus:outline-none focus:ring-2 focus:ring-ink/30"
        >
          筛选
        </button>
        {hasFilter && (
          <Link
            href="/products"
            className="inline-flex items-center gap-1 rounded-md border border-line-strong bg-surface px-3 py-2 text-sm transition-colors hover:bg-surface-2"
          >
            <X className="h-4 w-4" />
            清空
          </Link>
        )}
      </form>

      {products.length === 0 ? (
        <EmptyState
          icon={<Package className="h-8 w-8" />}
          title={hasFilter ? "没有匹配的商品" : "还没有任何商品"}
          hint={
            hasFilter
              ? "试着调整搜索词或选择其他分类。"
              : "点击右上角「新建商品」开始录入你的第一个 SKU。"
          }
        />
      ) : (
        <SectionCard bodyClassName="overflow-x-auto">
          <table className="min-w-full divide-y divide-line text-sm">
            <thead className="bg-surface-2/50 text-xs uppercase tracking-wider text-ink-3">
              <tr>
                <th className="px-5 py-3 text-left font-medium">商品名</th>
                <th className="px-5 py-3 text-left font-medium">条码</th>
                <th className="px-5 py-3 text-left font-medium">分类</th>
                <th className="px-5 py-3 text-right font-medium">进价</th>
                <th className="px-5 py-3 text-right font-medium">售价</th>
                <th className="px-5 py-3 text-right font-medium">库存</th>
                <th className="px-5 py-3 text-left font-medium">到期日</th>
                <th className="px-5 py-3 text-left font-medium">货架</th>
                <th className="px-5 py-3 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {products.map((p) => {
                const isLowStock = p.stock <= p.lowStockThreshold;
                const days = daysUntil(p.expiryDate);
                const isExpired = days !== null && days < 0;
                const isExpiringSoon =
                  days !== null && days >= 0 && days <= 7;
                return (
                  <tr
                    key={p.id}
                    className="transition-colors hover:bg-surface-2"
                  >
                    <td className="px-5 py-3">
                      <div className="font-medium text-ink">{p.name}</div>
                      {(p.brand || p.spec) && (
                        <div className="mt-0.5 truncate text-xs text-ink-3 max-w-[220px]">
                          {[p.brand, p.spec].filter(Boolean).join(" · ")}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-ink-3">
                      {p.barcode ?? "—"}
                    </td>
                    <td className="px-5 py-3 text-ink-2">{p.category}</td>
                    <td className="px-5 py-3 text-right text-ink-2 tnum">
                      ¥{Number(p.costPrice.toString()).toFixed(2)}
                    </td>
                    <td className="px-5 py-3 text-right font-serif font-semibold text-ink tnum">
                      ¥{Number(p.salePrice.toString()).toFixed(2)}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {isLowStock ? (
                        <Pill tone="warning" variant="soft">
                          {p.stock} 件
                        </Pill>
                      ) : (
                        <span className="text-ink-2 tnum">{p.stock} 件</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {p.expiryDate ? (
                        <span
                          className={
                            isExpired
                              ? "text-danger"
                              : isExpiringSoon
                                ? "text-warning"
                                : "text-ink-3"
                          }
                        >
                          {formatDate(p.expiryDate)}
                          {days !== null && (
                            <span className="ml-1 text-[10px]">
                              {days >= 0 ? `${days} 天` : `已过 ${-days} 天`}
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-ink-3">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-ink-2">
                      {p.shelfLocation ?? "—"}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link
                        href={`/products/${p.id}/edit`}
                        className="inline-flex items-center gap-1 rounded-md border border-line-strong bg-surface px-2.5 py-1 text-xs font-medium text-ink transition-colors hover:bg-surface-2"
                      >
                        <Pencil className="h-3 w-3" />
                        编辑
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
