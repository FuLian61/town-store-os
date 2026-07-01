"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
  /** 简短提示用户的可读标题,例:看板加载失败 */
  title?: string;
  /** 引导返回的链接,默认回到 /dashboard */
  homeHref?: string;
};

/**
 * 通用 route-level error.tsx 主体。
 * 在 Server Component 抛错时,Next.js 会用最近一层 error.tsx 渲染这个组件。
 */
export function RouteError({
  error,
  reset,
  title = "页面出错了",
  homeHref = "/dashboard",
}: Props) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 px-6 py-20 text-center">
      <AlertTriangle className="h-10 w-10 text-danger" aria-hidden />
      <h2 className="font-serif text-2xl font-semibold text-ink">{title}</h2>
      <p className="max-w-md text-sm text-ink-2">
        {error.message || "服务器临时无法响应,请稍后再试。"}
      </p>
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={reset}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-surface transition-colors hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-accent/40"
        >
          重试
        </button>
        <a
          href={homeHref}
          className="rounded-md border border-line-strong bg-surface px-4 py-2 text-sm font-medium transition-colors hover:bg-surface-2"
        >
          回到看板
        </a>
      </div>
    </div>
  );
}
