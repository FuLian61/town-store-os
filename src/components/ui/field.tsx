import type { ReactNode } from "react";

type SectionProps = {
  title: string;
  description?: string;
  children: ReactNode;
};

/** 表单分组标题 + 内容。导出自 ui/field,统一新建/编辑表单的视觉。 */
export function FieldSection({ title, description, children }: SectionProps) {
  return (
    <section className="space-y-5 rounded-lg border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-3">
          {title}
        </h2>
        {description && (
          <p className="mt-1 text-sm text-ink-2">{description}</p>
        )}
      </div>
      {children}
    </section>
  );
}

export function FieldGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
  );
}

type FieldProps = {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  className?: string;
  children: ReactNode;
};

export function Field({ label, required, hint, error, className, children }: FieldProps) {
  return (
    <label className={`block space-y-1.5 ${className ?? ""}`}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-ink">
          {label}
          {required && (
            <span className="ml-0.5 text-danger" aria-label="必填">
              *
            </span>
          )}
        </span>
        {hint && <span className="text-xs text-ink-3">{hint}</span>}
      </div>
      {children}
      {error && <p className="text-xs text-danger">{error}</p>}
    </label>
  );
}

/**
 * 输入框统一样式 hasError 时边框变红。
 * 可以额外拼接 className,如 inputClass(false, "pl-9") 给搜索框让位给前导图标。
 */
export function inputClass(hasError = false, extra = ""): string {
  return [
    "w-full rounded-md border bg-surface px-3 py-2 text-sm text-ink",
    "placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-accent/20",
    "transition-colors",
    hasError
      ? "border-danger focus:border-danger"
      : "border-line-strong hover:border-ink-3 focus:border-accent",
    extra,
  ].join(" ");
}
