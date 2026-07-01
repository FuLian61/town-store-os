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
  Trash2,
  X,
} from "lucide-react";

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
          `销售成功：¥${num(body.sale.totalAmount).toFixed(2)}`,
        );
        router.push(`/sales/${body.sale.id}`);
        router.refresh();
        return;
      }

      const body = await res.json().catch(() => null);
      const err = body?.error;
      const fieldMessages = err?.fields
        ? Object.values(err.fields).flat().join("；")
        : null;
      setTopError(
        fieldMessages
          ? `${err.message}：${fieldMessages}`
          : (err?.message ?? `请求失败 (${res.status})`),
      );
    });
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_400px]">
      {/* 左：商品选择 */}
      <section className="space-y-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索商品名 / 品牌 / 规格"
            className="w-full rounded-md border border-zinc-200 bg-white py-2.5 pl-9 pr-3 text-sm shadow-sm focus:border-zinc-400 focus:outline-none dark:border-zinc-800 dark:bg-zinc-950"
            autoFocus
          />
        </div>

        <div className="text-xs text-zinc-500">
          {filtered.length} / {products.length} 件商品可售
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-200 p-8 text-center text-sm text-zinc-500 dark:border-zinc-800">
            没有匹配的商品
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
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
                  className="group flex flex-col items-start gap-1 rounded-lg border border-zinc-200 bg-white p-3 text-left transition hover:border-zinc-400 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-600"
                >
                  <div className="w-full">
                    <div className="font-medium text-sm text-zinc-900 dark:text-zinc-100 line-clamp-2">
                      {p.name}
                    </div>
                    {(p.brand || p.spec) && (
                      <div className="text-xs text-zinc-500 mt-0.5">
                        {[p.brand, p.spec].filter(Boolean).join(" · ")}
                      </div>
                    )}
                  </div>
                  <div className="flex w-full items-end justify-between mt-1">
                    <span className="text-base font-semibold tabular-nums">
                      ¥{num(p.salePrice).toFixed(2)}
                    </span>
                    <span
                      className={
                        outOfStock
                          ? "text-xs text-red-500 font-medium"
                          : remaining <= 3
                            ? "text-xs text-amber-600 font-medium"
                            : "text-xs text-zinc-400"
                      }
                    >
                      库存 {p.stock}
                    </span>
                  </div>
                  {inCart && (
                    <div className="text-xs text-zinc-900 dark:text-zinc-100 font-medium">
                      已加 {inCart.quantity} 件
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* 右：购物车 */}
      <aside className="lg:sticky lg:top-6 lg:self-start">
        <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-zinc-500" />
              <span className="font-medium text-sm">购物车</span>
              {cartItems.length > 0 && (
                <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-xs font-medium text-white dark:bg-zinc-50 dark:text-zinc-900">
                  {totals.itemCount}
                </span>
              )}
            </div>
            {cartItems.length > 0 && (
              <button
                type="button"
                onClick={clearCart}
                className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
              >
                清空
              </button>
            )}
          </div>

          {cartItems.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-zinc-400">
              点击左侧商品加入购物车
            </div>
          ) : (
            <ul className="divide-y divide-zinc-200 dark:divide-zinc-800 max-h-[calc(100vh-22rem)] overflow-y-auto">
              {cartItems.map((item) => {
                const sp = num(item.product.salePrice);
                const subtotal = sp * item.quantity;
                return (
                  <li key={item.product.id} className="px-4 py-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100 line-clamp-2">
                          {item.product.name}
                        </div>
                        <div className="text-xs text-zinc-500 mt-0.5 tabular-nums">
                          ¥{sp.toFixed(2)} × {item.quantity} = ¥
                          {subtotal.toFixed(2)}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeItem(item.product.id)}
                        className="text-zinc-400 hover:text-red-500"
                        aria-label="移除"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => updateQty(item.product.id, -1)}
                        className="rounded-md border border-zinc-200 p-1 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
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
                        className="w-14 rounded-md border border-zinc-200 bg-white px-2 py-1 text-center text-sm tabular-nums dark:border-zinc-800 dark:bg-zinc-950"
                      />
                      <button
                        type="button"
                        onClick={() => updateQty(item.product.id, 1)}
                        disabled={item.quantity >= item.product.stock}
                        className="rounded-md border border-zinc-200 p-1 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed dark:border-zinc-800 dark:hover:bg-zinc-900"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                      <span className="ml-auto text-xs text-zinc-400">
                        / 库存 {item.product.stock}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {cartItems.length > 0 && (
            <div className="border-t border-zinc-200 dark:border-zinc-800 p-4 space-y-3">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="备注（可选）"
                rows={2}
                maxLength={200}
                className="w-full resize-none rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm focus:border-zinc-400 focus:outline-none dark:border-zinc-800 dark:bg-zinc-950"
              />

              <div className="space-y-1 text-sm">
                <Row label="销售额" value={totals.amount} />
                <Row label="成本" value={totals.cost} muted />
                <div className="flex items-center justify-between border-t border-zinc-200 pt-2 dark:border-zinc-800">
                  <span className="font-medium">毛利</span>
                  <span
                    className={`text-lg font-semibold tabular-nums ${
                      totals.profit >= 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-red-600"
                    }`}
                  >
                    ¥{totals.profit.toFixed(2)}
                  </span>
                </div>
              </div>

              {topError && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
                  {topError}
                </div>
              )}

              <button
                type="button"
                onClick={submit}
                disabled={isPending}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
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
                className="block text-center text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
              >
                查看销售记录
              </Link>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

function Row({
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
      <span className={muted ? "text-zinc-500" : ""}>{label}</span>
      <span
        className={`tabular-nums ${muted ? "text-zinc-500" : "font-medium"}`}
      >
        ¥{value.toFixed(2)}
      </span>
    </div>
  );
}