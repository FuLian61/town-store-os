import Link from "next/link";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Plus,
} from "lucide-react";

const NAV_ITEMS = [
  {
    href: "/dashboard",
    label: "经营看板",
    icon: LayoutDashboard,
    description: "今日销售与提醒",
  },
  {
    href: "/products",
    label: "商品管理",
    icon: Package,
    description: "商品与库存",
  },
  {
    href: "/sales",
    label: "销售记录",
    icon: ShoppingCart,
    description: "历史销售明细",
  },
] as const;

const PRIMARY_ACTION = {
  href: "/sales/new",
  label: "新建销售",
  icon: Plus,
};

export function Sidebar() {
  return (
    <aside className="hidden md:flex md:w-60 md:flex-col md:fixed md:inset-y-0 md:z-30 md:border-r md:border-zinc-200 md:bg-white md:dark:border-zinc-800 md:dark:bg-zinc-950">
      <div className="flex h-16 items-center border-b border-zinc-200 px-6 dark:border-zinc-800">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900">
            <span className="text-sm font-bold">乡</span>
          </div>
          <div>
            <div className="text-sm font-semibold leading-tight">乡镇小店</div>
            <div className="text-[10px] text-zinc-500 leading-tight">
              town-store-os
            </div>
          </div>
        </Link>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {NAV_ITEMS.map((item) => (
          <SidebarLink key={item.href} {...item} />
        ))}
      </nav>

      <div className="border-t border-zinc-200 p-3 dark:border-zinc-800">
        <Link
          href={PRIMARY_ACTION.href}
          className="flex items-center justify-center gap-2 rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          <PRIMARY_ACTION.icon className="h-4 w-4" />
          {PRIMARY_ACTION.label}
        </Link>
        <p className="mt-3 text-center text-[10px] text-zinc-400">
          V0.1 · MVP
        </p>
      </div>
    </aside>
  );
}

function SidebarLink({
  href,
  label,
  icon: Icon,
  description,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-start gap-3 rounded-md px-3 py-2.5 text-sm transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-900"
    >
      <Icon className="mt-0.5 h-4 w-4 text-zinc-500 group-hover:text-zinc-900 dark:group-hover:text-zinc-100" />
      <div>
        <div className="font-medium text-zinc-900 dark:text-zinc-100">
          {label}
        </div>
        {description && (
          <div className="text-[10px] text-zinc-500 mt-0.5">
            {description}
          </div>
        )}
      </div>
    </Link>
  );
}