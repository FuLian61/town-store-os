"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";

/**
 * 用 MutationObserver 监听 <html> class 的变化,
 * 让 ThemeToggle 始终跟随全局主题变量,避免在 useEffect 里 setState 造成 cascading render。
 * 服务端渲染 snapshot 固定为 false,因此首屏不会 hydration mismatch。
 */
function subscribeDarkMode(callback: () => void): () => void {
  if (typeof document === "undefined") return () => {};
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  return () => observer.disconnect();
}

function readDarkMode(): boolean {
  return document.documentElement.classList.contains("dark");
}

function readDarkModeServer(): boolean {
  return false;
}

type Props = {
  className?: string;
};

export function ThemeToggle({ className }: Props) {
  const isDark = useSyncExternalStore(
    subscribeDarkMode,
    readDarkMode,
    readDarkModeServer,
  );

  function toggle() {
    const next = !isDark;
    if (next) document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      /* localStorage 不可用时静默回退 */
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "切换到浅色模式" : "切换到深色模式"}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-md text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink focus:outline-none focus:ring-2 focus:ring-accent/30 ${className ?? ""}`}
    >
      {isDark ? (
        <Sun className="h-4 w-4" aria-hidden />
      ) : (
        <Moon className="h-4 w-4" aria-hidden />
      )}
    </button>
  );
}
