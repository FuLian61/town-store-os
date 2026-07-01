"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  Loader2,
  Minus,
  Plus,
  Search,
  ShoppingCart,
  X,
} from "lucide-react";
import { SectionCard } from "./ui/section-card";

// 商品精简信息：从服务端拿过来只展示必要字段
export type PosProduct = {
  id: string;
  name: string;
  brand: string | null;
  spec: string | null;
  costPrice: string;
  salePrice: string;
  stock: number;
};

type CartItem = {
  product: PosProduct;
  quantity: number;
};

function num(v: string | number): number {
  return typeof v === "number" ? v : Number(v.toString());
}

export function SalePos({ products }: { products: PosProduct[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<Map<string, CartItem>>(new Map());
  const [note, setNote] = useState("");
  const [isPending, startTransition] = useTransition();
  const [topError, setTopError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.brand?.toLowerCase().includes(q) ?? false) ||
        (p.spec?.toLowerCase().includes(q) ?? false),
    );
  }, [products, query]);

  const cartItems = [...cart.values()].sort((a, b) =>
    a.product.name.localeCompare(b.product.name),
  );

  const totals = useMemo(() => {
    let amount = 0;
    let cost = 0;
    for (const item of cartItems) {
      const sp = num(item.product.salePrice);
      const cp = num(item.product.costPrice);
      amount += sp * item.quantity;
      cost += cp * item.quantity;
    }
    return {
      amount: Math.round(amount * 100) / 100,
      cost: Math.round(cost * 100) / 100,
      profit: Math.round((amount - cost) * 100) / 100,
      itemCount: cartItems.reduce((s, i) => s + i.quantity, 0),
    };
  }, [cartItems]);

  function addToCart(p: PosProduct) {
    setCart((prev) => {
      const next = new Map(prev);
      const existing = next.get(p.id);
      const currentQty = existing?.quantity ?? 0;
      if (currentQty + 1 > p.stock) {
        toast.error(`${p.name} 库存仅剩 ${p.stock} 件`);
        return prev;
      }
      next.set(p.id, { product: p, quantity: currentQty + 1 });
      return next;
    });
  }

  function updateQty(productId: string, delta: number) {
    setCart((prev) => {
      const next = new Map(prev);
      const item = next.get(productId);
      if (!item) return prev;
      const newQty = item.quantity + delta;
      if (newQty <= 0) {
        next.delete(productId);
        return next;
      }
      if (newQty > item.product.stock) {
        toast.error(`${item.product.name} 库存仅剩 ${item.product.stock} 件`);
        return prev;
      }
      next.set(productId, { ...item, quantity: newQty });
      return next;
    });
  }

  function removeItem(productId: string) {
    setCart((prev) => {
      const next = new Map(prev);
      next.delete(productId);
      return next;
    });
  }

  function clearCart() {
    setCart(new Map());
    setNote("");
  }

  async function submit() {
    if (cartItems.length === 0) return;
    setTopError(null);

    startTransition(async () => {
      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cartItems.map((it) => ({
            productId: it.product.id,
            quantity: it.quantity,
          })),
          note: note.trim() || undefined,
        }),
      });

      if (res.ok) {
        const body = await res.json();
        toast.success(
          `销售成功:¥${num(body.sale.totalAmount).toFixed(2)}`,
        );
        router.push(`/sales/${body.sale.id}`);
        router.refresh();
        return;
      }

      const body = await res.json().catch(() => null);
      const err = body?.error;
      const fieldMessages = err?.fields
        ? Object.values(err.fields).flat().join(";")
        : null;
      setTopError(
        fieldMessages
          ? `${err.message}:${fieldMessages}`
          : (err?.message ?? `请求失败 (${res.status})`),
      );
    });
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_400px]">
      {/* 左:商品选择 */}
      <section className="space-y-4">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3"
            aria-hidden
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索商品名 / 品牌 / 规格"
            className="w-full rounded-md border border-line-strong bg-surface py-2.5 pl-9 pr-3 text-sm text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
            autoFocus
          />
        </div>

        <div className="text-xs text-ink-3 tnum">
          {filtered.length} / {products.length} 件商品可售
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-lg border border-dashed border-line-strong bg-surface px-6 py-10 text-center text-sm text-ink-2">
            没有匹配的商品
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((p) => {
              const inCart = cart.get(p.id);
              const remaining = p.stock - (inCart?.quantity ?? 0);
              const outOfStock = remaining <= 0;
              return (
                <button
                  key={p.id}
                  type="button"
                  disabled={outOfStock}
                  onClick={() => addToCart(p)}
                  className="group flex flex-col items-start gap-1.5 rounded-lg border border-line bg-surface p-3.5 text-left transition hover:-translate-y-px hover:border-accent hover:shadow-[var(--shadow-pop)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:border-line disabled:hover:shadow-none"
                >
                  <div className="w-full">
                    <div className="line-clamp-2 text-sm font-medium text-ink">
                      {p.name}
                    </div>
                    {(p.brand || p.spec) && (
                      <div className="mt-0.5 truncate text-xs text-ink-3">
                        {[p.brand, p.spec].filter(Boolean).join(" · ")}
                      </div>
                    )}
                  </div>
                  <div className="mt-1.5 flex w-full items-end justify-between">
                    <span className="font-serif text-base font-semibold text-ink tnum">
                      ¥{num(p.salePrice).toFixed(2)}
                    </span>
                    <span
                      className={
                        outOfStock
                          ? "text-xs font-medium text-danger"
                          : remaining <= 3
                            ? "text-xs font-medium text-warning"
                            : "text-xs text-ink-3"
                      }
                    >
                      库存 {p.stock}
                    </span>
                  </div>
                  {inCart && (
                    <div className="text-xs font-medium text-accent">
                      已加 {inCart.quantity} 件
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* 右:购物车 */}
      <aside className="lg:sticky lg:top-6 lg:self-start">
        <SectionCard
          title="购物车"
          icon={<ShoppingCart className="h-4 w-4" />}
          count={cartItems.length > 0 ? totals.itemCount : undefined}
          headerAction={
            cartItems.length > 0 ? (
              <button
                type="button"
                onClick={clearCart}
                className="text-xs text-ink-3 transition-colors hover:text-ink"
              >
                清空
              </button>
            ) : undefined
          }
        >
          {cartItems.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-ink-3">
              点击左侧商品加入购物车
            </div>
          ) : (
            <ul className="scrollbar-thin max-h-[calc(100vh-26rem)] divide-y divide-line overflow-y-auto">
              {cartItems.map((item) => {
                const sp = num(item.product.salePrice);
                const subtotal = sp * item.quantity;
                return (
                  <li key={item.product.id} className="space-y-2 px-5 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="line-clamp-2 text-sm font-medium text-ink">
                          {item.product.name}
                        </div>
                        <div className="mt-0.5 text-xs text-ink-3 tnum">
                          ¥{sp.toFixed(2)} × {item.quantity} ={" "}
                          <span className="text-ink-2">¥{subtotal.toFixed(2)}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeItem(item.product.id)}
                        className="rounded-md p-1 text-ink-3 transition-colors hover:bg-danger-bg hover:text-danger"
                        aria-label="移除"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => updateQty(item.product.id, -1)}
                        className="rounded-md border border-line-strong p-1 transition-colors hover:bg-surface-2"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <input
                        type="number"
                        min="1"
                        max={item.product.stock}
                        value={item.quantity}
                        onChange={(e) => {
                          const v = parseInt(e.target.value, 10);
                          if (!Number.isFinite(v) || v <= 0) return;
                          const delta = v - item.quantity;
                          updateQty(item.product.id, delta);
                        }}
                        className="w-14 rounded-md border border-line-strong bg-surface px-2 py-1 text-center text-sm text-ink tnum focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                      />
                      <button
                        type="button"
                        onClick={() => updateQty(item.product.id, 1)}
                        disabled={item.quantity >= item.product.stock}
                        className="rounded-md border border-line-strong p-1 transition-colors hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-surface"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                      <span className="ml-auto text-xs text-ink-3 tnum">
                        / 库存 {item.product.stock}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {cartItems.length > 0 && (
            <div className="space-y-3 border-t border-line p-5">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="备注(可选)"
                rows={2}
                maxLength={200}
                className="w-full resize-none rounded-md border border-line-strong bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
              />

              <div className="space-y-1.5 text-sm">
                <SummaryRow label="销售额" value={totals.amount} />
                <SummaryRow label="成本" value={totals.cost} muted />
                <div className="flex items-center justify-between border-t border-line pt-3">
                  <span className="font-medium text-ink">毛利</span>
                  <span
                    className={`font-serif text-lg font-semibold tnum ${
                      totals.profit >= 0 ? "text-positive" : "text-danger"
                    }`}
                  >
                    ¥{totals.profit.toFixed(2)}
                  </span>
                </div>
              </div>

              {topError && (
                <div className="rounded-md border border-danger/40 bg-danger-bg/50 px-3 py-2 text-xs text-danger">
                  {topError}
                </div>
              )}

              <button
                type="button"
                onClick={submit}
                disabled={isPending}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-accent px-4 py-3 text-sm font-medium text-surface transition-colors hover:bg-accent-hover disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-accent/40"
              >
                {isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ShoppingCart className="h-4 w-4" />
                )}
                确认销售 ¥{totals.amount.toFixed(2)}
              </button>

              <Link
                href="/sales"
                className="block text-center text-xs text-ink-3 transition-colors hover:text-ink"
              >
                查看销售记录 →
              </Link>
            </div>
          )}
        </SectionCard>
      </aside>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  muted,
}: {
  label: string;
  value: number;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={muted ? "text-ink-3" : "text-ink-2"}>{label}</span>
      <span
        className={`tnum ${muted ? "text-ink-3" : "font-medium text-ink"}`}
      >
        ¥{value.toFixed(2)}
      </span>
    </div>
  );
}
