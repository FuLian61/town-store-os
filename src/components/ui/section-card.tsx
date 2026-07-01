import type { ReactNode } from "react";
import { Pill } from "./pill";
import type { Tone } from "./pill";

type HeaderAction = {
  label: string;
  href: string;
  /** 可选右侧图标 */
  trailingIcon?: ReactNode;
};

type Props = {
  title?: string;
  icon?: ReactNode;
  count?: number;
  countTone?: Tone;
  headerAction?: HeaderAction | ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  bodyClassName?: string;
};

/**
 * 给 dashboard 的「低库存提醒」「临期提醒」「今日销售」用的卡片容器。
 * header = 图标 + 标题 + 计数徽章 + 可选右侧链接,
 * body = 列表或任意内容(由调用方自行决定是否 divide-y),
 * footer = 可选次级信息栏。
 */
export function SectionCard({
  title,
  icon,
  count,
  countTone = "neutral",
  headerAction,
  children,
  footer,
  className,
  bodyClassName,
}: Props) {
  return (
    <section
      className={`overflow-hidden rounded-lg border border-line bg-surface shadow-[var(--shadow-card)] ${className ?? ""}`}
    >
      {(title || icon || headerAction) && (
        <header className="flex items-center justify-between gap-3 border-b border-line bg-surface-2/50 px-5 py-3">
          <div className="flex items-center gap-2">
            {icon && <span className="text-ink-2">{icon}</span>}
            {title && (
              <h3 className="text-sm font-semibold text-ink">{title}</h3>
            )}
            {typeof count === "number" && count > 0 && (
              <Pill tone={countTone} variant="solid">
                {count}
              </Pill>
            )}
          </div>
          {renderHeaderAction(headerAction)}
        </header>
      )}
      <div className={bodyClassName ?? ""}>{children}</div>
      {footer && (
        <div className="border-t border-line bg-surface-2/30 px-5 py-2 text-xs text-ink-2">
          {footer}
        </div>
      )}
    </section>
  );
}

function renderHeaderAction(
  action: HeaderAction | ReactNode | undefined,
): ReactNode {
  if (!action) return null;
  if (typeof action === "object" && action !== null && "href" in action && "label" in action) {
    const a = action as HeaderAction;
    return (
      <a
        href={a.href}
        className="inline-flex items-center gap-1 text-xs text-ink-2 transition-colors hover:text-ink"
      >
        {a.label}
        {a.trailingIcon ?? null}
      </a>
    );
  }
  return action;
}
