"use client";

import { useState } from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  Menu,
  Package,
  Plus,
  ShoppingCart,
  X,
} from "lucide-react";

const ITEMS = [
  { href: "/dashboard", label: "经营看板", icon: LayoutDashboard },
  { href: "/products", label: "商品管理", icon: Package },
  { href: "/sales", label: "销售记录", icon: ShoppingCart },
] as const;

export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-zinc-200 bg-white/95 px-4 backdrop-blur md:hidden dark:border-zinc-800 dark:bg-zinc-950/95">
        <Link
          href="/dashboard"
          className="flex items-center gap-2"
          onClick={() => setOpen(false)}
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900">
            <span className="text-xs font-bold">乡</span>
          </div>
          <span className="text-sm font-semibold">乡镇小店</span>
        </Link>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
          aria-label="打开菜单"
        >
          <Menu className="h-5 w-5" />
        </button>
      </header>

      {open && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/50 md:hidden"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <aside className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-white shadow-xl md:hidden dark:bg-zinc-950">
            <div className="flex h-14 items-center justify-between border-b border-zinc-200 px-4 dark:border-zinc-800">
              <span className="text-sm font-semibold">菜单</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900"
                aria-label="关闭菜单"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 space-y-1 p-3">
              {ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-zinc-900 hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-900"
                >
                  <item.icon className="h-4 w-4 text-zinc-500" />
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="border-t border-zinc-200 p-3 dark:border-zinc-800">
              <Link
                href="/sales/new"
                onClick={() => setOpen(false)}
                className="flex items-center justify-center gap-2 rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                <Plus className="h-4 w-4" />
                新建销售
              </Link>
            </div>
          </aside>
        </>
      )}
    </>
  );
}