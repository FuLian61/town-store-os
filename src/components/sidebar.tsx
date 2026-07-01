"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, PRIMARY_ACTION, isActivePath } from "./nav-items";
import { ThemeToggle } from "./ui/theme-toggle";
import { formatDate } from "@/lib/format";

export function Sidebar() {
  const pathname = usePathname() ?? "";
  const today = formatDate(new Date());

  return (
    <aside className="hidden md:flex md:w-60 md:flex-col md:fixed md:inset-y-0 md:z-30 md:border-r md:border-line md:bg-surface">
      <div className="flex h-16 items-center border-b border-line px-5">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-ink text-surface font-serif text-base font-semibold">
            乡
          </div>
          <div className="leading-tight">
            <div className="font-serif text-base font-semibold text-ink">
              乡镇小店
            </div>
            <div className="text-[10px] uppercase tracking-wider text-ink-3">
              town-store-os
            </div>
          </div>
        </Link>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {NAV_ITEMS.map((item) => {
          const active = isActivePath(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`group relative flex items-start gap-3 rounded-md px-3 py-2.5 text-sm transition-colors ${
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
                className={`mt-0.5 h-4 w-4 flex-none ${
                  active ? "text-accent" : "text-ink-3 group-hover:text-ink-2"
                }`}
              />
              <div className="min-w-0">
                <div className="font-medium">{item.label}</div>
                <div className="mt-0.5 text-[11px] text-ink-3">
                  {item.description}
                </div>
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-line p-3">
        <Link
          href={PRIMARY_ACTION.href}
          className="flex items-center justify-center gap-2 rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-surface transition-colors hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-accent/40"
        >
          <PRIMARY_ACTION.icon className="h-4 w-4" />
          {PRIMARY_ACTION.label}
        </Link>

        <div className="mt-4 flex items-center justify-between">
          <p className="font-serif text-xs italic text-ink-3">
            今天 · {today.replace(/-/g, "/")}
          </p>
          <ThemeToggle />
        </div>
        <p className="mt-1 text-center text-[10px] uppercase tracking-wider text-ink-3">
          V0.1 · MVP
        </p>
      </div>
    </aside>
  );
}
