import type { ReactNode } from "react";

type Props = {
  icon?: ReactNode;
  title: string;
  hint?: ReactNode;
  action?: ReactNode;
  className?: string;
};

/**
 * 统一的空状态:边框虚线 + 居中图案 + 标题 + 提示 + 可选 CTA。
 * 替换原先散落在 dashboard、products、sales、sale-pos 的三套不同写法。
 */
export function EmptyState({ icon, title, hint, action, className }: Props) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-line-strong bg-surface px-6 py-14 text-center ${className ?? ""}`}
    >
      {icon && <div className="text-ink-3">{icon}</div>}
      <div className="space-y-1">
        <p className="text-sm font-medium text-ink-2">{title}</p>
        {hint && <p className="text-xs text-ink-3">{hint}</p>}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
