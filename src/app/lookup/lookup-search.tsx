"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

type Props = {
  initial?: string;
};

/**
 * 快速查价的搜索框:
 * - autofocus 大输入框,适合扫码枪(回车提交等价于持续 debounce 推 URL)
 * - 300ms debounce 推 searchParams.q,触发服务端重渲染
 * - 卸载时清 timer,空 query 推 /lookup(无 query)回到初始态
 */
export function LookupSearch({ initial = "" }: Props) {
  const [value, setValue] = useState(initial);
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // 跳过初次 mount(无变化)
    if (value === initial) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const trimmed = value.trim();
      const href = trimmed
        ? `/lookup?q=${encodeURIComponent(trimmed)}`
        : "/lookup";
      router.push(href);
    }, 300);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [value, initial, router]);

  return (
    <div className="relative">
      <Search
        className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-3"
        aria-hidden
      />
      <input
        type="text"
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="输入商品名、条码或品牌…"
        className="w-full rounded-xl border border-line-strong bg-surface py-4 pl-14 pr-4 text-lg text-ink placeholder:text-ink-3 shadow-[var(--shadow-card)] focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/20"
      />
    </div>
  );
}
