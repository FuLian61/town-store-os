import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright 配置
 *
 * 默认自带 webServer 自动跑 `pnpm db:seed && pnpm start`,测试完全隔离在
 * Playwright 进程里 — 跑完即销毁,不动用户跑着的 dev/start。
 * 跑测试前请确保 postgres 在 5432 监听且已 `pnpm prisma migrate deploy` 跑过。
 *
 * 用法:
 *   pnpm test:e2e          # 默认:webServer 模式
 *   BASE_URL=http://localhost:4000 pnpm test:e2e   # 复用现有 server
 *   pnpm test:e2e:headed   # 看浏览器跑
 *   pnpm test:e2e:ui       # Playwright 自带 UI 调试
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? "dot" : "list",
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    viewport: { width: 1280, height: 800 },
    locale: "zh-CN",
    timezoneId: "Asia/Shanghai",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: process.env.BASE_URL
    ? undefined
    : {
        // 仅在未指定 BASE_URL 时启用,避免和外部 dev/start 抢端口
        command: "pnpm db:seed && pnpm start",
        url: "http://localhost:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
        stdout: "ignore",
        stderr: "pipe",
      },
});
