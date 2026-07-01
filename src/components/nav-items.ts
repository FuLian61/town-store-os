import {
  LayoutDashboard,
  Package,
  ScanLine,
  ShoppingCart,
  Plus,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
};

export const NAV_ITEMS: readonly NavItem[] = [
  {
    href: "/dashboard",
    label: "经营看板",
    description: "今日销售与提醒",
    icon: LayoutDashboard,
  },
  {
    href: "/lookup",
    label: "快速查价",
    description: "按名称 / 条码搜索",
    icon: ScanLine,
  },
  {
    href: "/products",
    label: "商品管理",
    description: "商品与库存",
    icon: Package,
  },
  {
    href: "/sales",
    label: "销售记录",
    description: "历史销售明细",
    icon: ShoppingCart,
  },
] as const;

export const PRIMARY_ACTION = {
  href: "/sales/new",
  label: "新建销售",
  icon: Plus,
} as const;

/** 判断 href 是否命中当前路径(支持 /sales/{id} 这种子路径) */
export function isActivePath(currentPath: string, href: string) {
  if (href === "/dashboard") return currentPath === "/" || currentPath === "/dashboard";
  return currentPath === href || currentPath.startsWith(`${href}/`);
}
