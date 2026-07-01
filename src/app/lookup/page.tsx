import Link from "next/link";
import { Barcode, Search as SearchIcon } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { daysUntil, formatDate, formatPrice } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Pill } from "@/components/ui/pill";
import { LookupSearch } from "./lookup-search";

export const dynamic = "force-dynamic";

const SEARCH_LIMIT = 50;

type SearchParams = Promise<{ q?: string }>;

export default async function LookupPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { q } = await searchParams;
  const trimmed = q?.trim() ?? "";

  const products = trimmed
    ? await prisma.product.findMany({
        where: {
          OR: [
            { name: { contains: trimmed, mode: "insensitive" } },
            { barcode: { contains: trimmed, mode: "insensitive" } },
            { brand: { contains: trimmed, mode: "insensitive" } },
            { category: { contains: trimmed, mode: "insensitive" } },
          ],
        },
        orderBy: { name: "asc" },
        take: SEARCH_LIMIT,
      })
    : [];

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-8">
      <PageHeader
        title="快速查价"
        description="按商品名、条码、品牌、分类查找商品价格与库存。可直接用扫码枪对准此页输入。"
      />

      <LookupSearch initial={trimmed} />

      {trimmed.length === 0 ? (
        <EmptyState
          icon={<Barcode className="h-10 w-10" />}
          title="还没输入查询"
          hint="在上方输入商品名、条码或品牌开始查询。"
        />
      ) : products.length === 0 ? (
        <EmptyState
          icon={<SearchIcon className="h-10 w-10" />}
          title="没有匹配的商品"
          hint={`没有找到包含「${trimmed}」的商品,试试换个关键词,或者新增一个。`}
          action={
            <Link
              href="/products/new"
              className="inline-flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-sm font-medium text-surface transition-colors hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-accent/40"
            >
              <Barcode className="h-4 w-4" />
              新建商品
            </Link>
          }
        />
      ) : products.length === 1 ? (
        <SingleResult product={products[0]} />
      ) : (
        <ResultsGrid products={products} />
      )}
    </div>
  );
}

type Product = Awaited<
  ReturnType<typeof prisma.product.findMany<{ take: 1 }>>
>[number];

function SingleResult({ product: p }: { product: Product }) {
  const lowStock = p.stock <= p.lowStockThreshold;
  const days = daysUntil(p.expiryDate);
  const expired = days !== null && days < 0;
  const soon = days !== null && days >= 0 && days <= 7;

  return (
    <SectionCard
      title="匹配结果"
      icon={<Barcode className="h-4 w-4" />}
      count={1}
      headerAction={
        <Link
          href={`/products/${p.id}/edit`}
          className="text-xs text-ink-2 transition-colors hover:text-ink"
        >
          编辑商品 →
        </Link>
      }
    >
      <div className="grid grid-cols-1 gap-6 p-6 md:grid-cols-[1fr_auto] md:items-center">
        <div className="min-w-0 space-y-2">
          <h3 className="font-serif text-2xl font-semibold text-ink">
            {p.name}
          </h3>
          {(p.brand || p.spec) && (
            <p className="text-sm text-ink-3">
              {[p.brand, p.spec].filter(Boolean).join(" · ")}
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Pill tone="neutral" variant="outline">
              {p.category}
            </Pill>
            {p.barcode && (
              <span className="inline-flex items-center gap-1 rounded-full border border-line-strong px-2 py-0.5 font-mono text-xs text-ink-3">
                <Barcode className="h-3 w-3" />
                {p.barcode}
              </span>
            )}
          </div>
        </div>

        <div className="md:text-right">
          <div className="text-xs uppercase tracking-wider text-ink-3">
            售价
          </div>
          <div className="font-serif text-6xl font-semibold leading-none text-ink tnum">
            {formatPrice(p.salePrice)}
          </div>
          <div className="mt-1 text-xs text-ink-3 tnum">
            成本 {formatPrice(p.costPrice)} · 毛利{" "}
            {formatPrice(
              Number(p.salePrice.toString()) - Number(p.costPrice.toString()),
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 border-t border-line bg-surface-2/30 px-6 py-4 sm:grid-cols-4">
        <Stat label="当前库存">
          {lowStock ? (
            <Pill tone="warning" variant="soft">
              {p.stock} 件
            </Pill>
          ) : (
            <span className="font-serif text-xl font-semibold text-ink tnum">
              {p.stock} 件
            </span>
          )}
        </Stat>
        <Stat label="低库存阈值">
          <span className="text-ink-2 tnum">{p.lowStockThreshold} 件</span>
        </Stat>
        <Stat label="到期日">
          {p.expiryDate ? (
            <span
              className={`tnum ${expired ? "text-danger" : soon ? "text-warning" : "text-ink-2"}`}
            >
              {formatDate(p.expiryDate)}
              {days !== null && (
                <span className="ml-1 text-[10px] text-ink-3">
                  {days >= 0 ? `${days} 天` : `已过 ${-days} 天`}
                </span>
              )}
            </span>
          ) : (
            <span className="text-ink-3">—</span>
          )}
        </Stat>
        <Stat label="货架">
          <span className="font-mono text-sm text-ink-2">
            {p.shelfLocation ?? "—"}
          </span>
        </Stat>
      </div>
    </SectionCard>
  );
}

function ResultsGrid({ products }: { products: Product[] }) {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h3 className="text-xs uppercase tracking-wider text-ink-3">
          匹配结果
        </h3>
        <p className="text-xs text-ink-3 tnum">{products.length} 件</p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((p) => {
          const lowStock = p.stock <= p.lowStockThreshold;
          const days = daysUntil(p.expiryDate);
          const expired = days !== null && days < 0;
          const soon = days !== null && days >= 0 && days <= 7;
          return (
            <Link
              key={p.id}
              href={`/products/${p.id}/edit`}
              className="group flex flex-col gap-2 rounded-lg border border-line bg-surface p-4 transition hover:-translate-y-px hover:border-accent hover:shadow-[var(--shadow-pop)]"
            >
              <div className="min-h-[2.5rem]">
                <div className="line-clamp-2 font-medium text-ink">{p.name}</div>
                {(p.brand || p.spec) && (
                  <div className="mt-0.5 truncate text-xs text-ink-3">
                    {[p.brand, p.spec].filter(Boolean).join(" · ")}
                  </div>
                )}
              </div>
              <div className="mt-auto flex items-end justify-between">
                <span className="font-serif text-2xl font-semibold text-ink tnum">
                  {formatPrice(p.salePrice)}
                </span>
                {lowStock ? (
                  <Pill tone="warning" variant="soft">
                    {p.stock} 件
                  </Pill>
                ) : (
                  <span className="text-xs text-ink-3 tnum">
                    库存 {p.stock}
                  </span>
                )}
              </div>
              {p.expiryDate && (expired || soon) && (
                <div>
                  <Pill tone={expired ? "danger" : "warning"} variant="soft">
                    {expired
                      ? `已过期 ${-(days ?? 0)} 天`
                      : `${days ?? 0} 天到期`}
                  </Pill>
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function Stat({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-xs text-ink-3">{label}</div>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
