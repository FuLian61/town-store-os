import { Loader2 } from "lucide-react";

type Props = {
  label?: string;
};

/** 用于 route-level loading.tsx 的占位视图。 */
export function LoadingView({ label = "正在加载…" }: Props) {
  return (
    <div
      role="status"
      aria-label={label}
      className="mx-auto flex max-w-5xl items-center justify-center gap-3 px-6 py-20 text-ink-2"
    >
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      <span className="text-sm">{label}</span>
    </div>
  );
}
