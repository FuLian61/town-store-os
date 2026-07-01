"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { NAV_ITEMS, PRIMARY_ACTION, isActivePath } from "./nav-items";
import { ThemeToggle } from "./ui/theme-toggle";

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname() ?? "";

  return (
    <>
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-line bg-surface/95 px-4 backdrop-blur md:hidden">
        <Link
          href="/dashboard"
          className="flex items-center gap-2"
          onClick={() => setOpen(false)}
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-ink font-serif text-xs font-semibold text-surface">
            乡
          </div>
          <span className="font-serif text-sm font-semibold text-ink">
            乡镇小店
          </span>
        </Link>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink focus:outline-none focus:ring-2 focus:ring-accent/30"
            aria-label="打开菜单"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </header>

      {open && (
        <>
          <div
            className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-sm md:hidden"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <aside className="fixed inset-y-0 right-0 z-50 flex w-72 max-w-[80vw] flex-col bg-surface shadow-[var(--shadow-pop)] md:hidden">
            <div className="flex h-14 items-center justify-between border-b border-line px-5">
              <span className="font-serif text-sm font-semibold text-ink">
                菜单
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
                aria-label="关闭菜单"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 space-y-1 p-3">
              {NAV_ITEMS.map((item) => {
                const active = isActivePath(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={`group relative flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors ${
                      active
                        ? "bg-accent-bg text-accent"
                        : "text-ink hover:bg-surface-2"
                    }`}
                  >
                    {active && (
                      <span
                        aria-hidden
                        className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-accent"
                      />
                    )}
                    <item.icon
                      className={`h-4 w-4 ${
                        active ? "text-accent" : "text-ink-3"
                      }`}
                    />
                    <span className="font-medium">{item.label}</span>
                  </Link>
                );
              })}
            </nav>
            <div className="border-t border-line p-3">
              <Link
                href={PRIMARY_ACTION.href}
                onClick={() => setOpen(false)}
                className="flex items-center justify-center gap-2 rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-surface transition-colors hover:bg-accent-hover"
              >
                <PRIMARY_ACTION.icon className="h-4 w-4" />
                {PRIMARY_ACTION.label}
              </Link>
            </div>
          </aside>
        </>
      )}
    </>
  );
}
