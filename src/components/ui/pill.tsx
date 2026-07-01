import type { ReactNode } from "react";

export type Tone =
  | "neutral"
  | "positive"
  | "warning"
  | "danger"
  | "accent"
  | "info";
type Variant = "solid" | "soft" | "outline";

const TONE: Record<Tone, Record<Variant, string>> = {
  neutral: {
    solid: "bg-ink-3 text-surface",
    soft: "bg-surface-2 text-ink-2",
    outline: "border border-line-strong text-ink-2",
  },
  positive: {
    solid: "bg-positive text-white",
    soft: "bg-positive-bg text-positive",
    outline: "border border-positive/40 text-positive",
  },
  warning: {
    solid: "bg-warning text-white",
    soft: "bg-warning-bg text-warning",
    outline: "border border-warning/40 text-warning",
  },
  danger: {
    solid: "bg-danger text-white",
    soft: "bg-danger-bg text-danger",
    outline: "border border-danger/40 text-danger",
  },
  accent: {
    solid: "bg-accent text-white",
    soft: "bg-accent-bg text-accent",
    outline: "border border-accent/40 text-accent",
  },
  info: {
    solid: "bg-accent text-white",
    soft: "bg-accent-bg text-accent",
    outline: "border border-accent/30 text-accent",
  },
};

type Props = {
  tone?: Tone;
  variant?: Variant;
  children: ReactNode;
  className?: string;
};

export function Pill({ tone = "neutral", variant = "soft", children, className }: Props) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${TONE[tone][variant]} ${className ?? ""}`}
    >
      {children}
    </span>
  );
}
