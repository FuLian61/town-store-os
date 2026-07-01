import type { ReactNode } from "react";

type Accent = "neutral" | "positive" | "warning" | "danger" | "accent" | "muted";

const VALUE_CLS: Record<Accent, string> = {
  neutral: "text-ink",
  muted: "text-ink-2",
  accent: "text-accent",
  positive: "text-positive",
  warning: "text-warning",
  danger: "text-danger",
};

type Props = {
  label: string;
  /** 主要数值;调用方按需包裹 serif 样式 */
  value: ReactNode;
  sub?: ReactNode;
  icon?: ReactNode;
  accent?: Accent;
  className?: string;
};

export function StatCard({
  label,
  value,
  sub,
  icon,
  accent = "neutral",
  className,
}: Props) {
  return (
    <div
      className={`rounded-lg border border-line bg-surface p-5 shadow-[var(--shadow-card)] ${className ?? ""}`}
    >
      <div className="flex items-center justify-between text-ink-2">
        <span className="text-xs font-medium uppercase tracking-wider">
          {label}
        </span>
        {icon && <span className="text-ink-3">{icon}</span>}
      </div>
      <div className={`mt-3 font-serif text-3xl font-semibold tnum leading-none ${VALUE_CLS[accent]}`}>
        {value}
      </div>
      {sub && (
        <div className="mt-2 text-xs text-ink-2 tnum">{sub}</div>
      )}
    </div>
  );
}
