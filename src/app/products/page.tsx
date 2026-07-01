import Link from "next/link";
import { Pencil, Plus, Search } from "lucide-react";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { daysUntil, formatDate, formatPrice } from "@/lib/format";

type SearchParams = Promise<{ q?: string; category?: string }>;

const LOW_STOCK_WINDOW_DAYS = 7;

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
      take: 200,
    }),
    prisma.product.findMany({
      select: { category: true },
      distinct: ["category"],
      orderBy: { category: "asc" },
    }),
  ]);

  return (
    <div className="mx-auto max-w-7xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">商品管理</h1>
          <p className="text-sm text-zinc-500 mt-1">
            共 {products.length} 条{products.length === 200 ? "（已达上限 200）" : ""}
          </p>
        </div>
        <Link
          href="/products/new"
          className="inline-flex items-center gap-1.5 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          <Plus className="h-4 w-4" />
          新建商品
        </Link>
      </div>

      <form
        action="/products"
        method="GET"
        className="flex flex-wrap items-center gap-2"
      >
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            name="q"
            defaultValue={q ?? ""}
            placeholder="搜索商品名 / 条码 / 品牌"
            className="w-full rounded-md border border-zinc-200 bg-white py-2 pl-9 pr-3 text-sm placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none dark:border-zinc-800 dark:bg-zinc-950"
          />
        </div>
        <select
          name="category"
          defaultValue={category ?? ""}
          className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm focus:border-zinc-400 focus:outline-none dark:border-zinc-800 dark:bg-zinc-950"
        >
          <option value="">全部分类</option>
          {categories.map((c) => (
            <option key={c.category} value={c.category}>
              {c.category}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900"
        >
          搜索
        </button>
        {(q || category) && (
          <Link
            href="/products"
            className="rounded-md px-3 py-2 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            清空
          </Link>
        )}
      </form>

      {products.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-200 p-12 text-center text-sm text-zinc-500 dark:border-zinc-800">
          {q || category ? "没有匹配的商品" : "还没有商品，点击右上角“新建商品”开始录入"}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wider text-zinc-500 dark:bg-zinc-900">
              <tr>
                <th className="px-4 py-3 font-medium">商品名</th>
                <th className="px-4 py-3 font-medium">条码</th>
                <th className="px-4 py-3 font-medium">分类</th>
                <th className="px-4 py-3 font-medium text-right">进价</th>
                <th className="px-4 py-3 font-medium text-right">售价</th>
                <th className="px-4 py-3 font-medium text-right">库存</th>
                <th className="px-4 py-3 font-medium">到期日</th>
                <th className="px-4 py-3 font-medium">货架</th>
                <th className="px-4 py-3 font-medium w-20">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {products.map((p) => {
                const isLowStock = p.stock <= p.lowStockThreshold;
                const days = daysUntil(p.expiryDate);
                const isExpired = days !== null && days < 0;
                const isExpiringSoon =
                  days !== null && days >= 0 && days <= LOW_STOCK_WINDOW_DAYS;
                return (
                  <tr
                    key={p.id}
                    className="bg-white hover:bg-zinc-50 dark:bg-zinc-950 dark:hover:bg-zinc-900"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-zinc-900 dark:text-zinc-100">
                        {p.name}
                      </div>
                      {(p.brand || p.spec) && (
                        <div className="text-xs text-zinc-500 mt-0.5">
                          {[p.brand, p.spec].filter(Boolean).join(" · ")}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400 font-mono text-xs">
                      {p.barcode ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      {p.category}
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-600 dark:text-zinc-400 tabular-nums">
                      {formatPrice(p.costPrice)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">
                      {formatPrice(p.salePrice)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <span
                        className={
                          isLowStock
                            ? "inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-200"
                            : "text-zinc-900 dark:text-zinc-100"
                        }
                      >
                        {p.stock}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {p.expiryDate ? (
                        <span
                          className={
                            isExpired
                              ? "text-red-600 dark:text-red-400 font-medium"
                              : isExpiringSoon
                                ? "text-amber-600 dark:text-amber-400 font-medium"
                                : "text-zinc-600 dark:text-zinc-400"
                          }
                          title={
                            days !== null
                              ? isExpired
                                ? `已过期 ${-days} 天`
                                : `${days} 天后到期`
                              : undefined
                          }
                        >
                          {formatDate(p.expiryDate)}
                        </span>
                      ) : (
                        <span className="text-zinc-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      {p.shelfLocation ?? "-"}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/products/${p.id}/edit`}
                        className="inline-flex items-center gap-1 text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        编辑
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