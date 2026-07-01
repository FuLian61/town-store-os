# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目定位

`town-store-os` 是面向**乡镇小超市/便利店店主**的轻量化经营后台(MVP 只做店主侧,不做顾客端/会员)。产品定位、技术栈、后续阶段路线见 [README.md](README.md)。

## 命令

所有命令走 `pnpm`。`pnpm-workspace.yaml` 已配 `packages: ['.']`,所有脚本就这一个包。

| 命令 | 用途 |
|---|---|
| `pnpm dev` | 起 Next dev server (默认 3000) |
| `pnpm build` | 生产构建(`next build`) |
| `pnpm start` | 跑生产 server(`next start`) |
| `pnpm lint` | ESLint(`eslint`,无额外 flag) |
| `pnpm tsc --noEmit` | TypeScript 类型检查 |
| `pnpm prisma:generate` | 重新生成 Prisma client |
| `pnpm prisma:migrate` | 开发态迁移(起 dev) |
| `pnpm db:seed` | 灌 30 件 demo 商品的种子数据(幂等) |
| `pnpm db:reset` | **破坏性** 清库 + 重灌 |
| `pnpm smoke` | 跑 `scripts/smoke.sh` 的 30 个端到端用例,需要 dev 或 start 在跑 |
| `pnpm test:e2e` | Playwright 真浏览器 E2E(默认 webServer 模式自动启 `pnpm db:seed && pnpm start`);`BASE_URL=...` 复用外部 server |
| `pnpm test:e2e:headed` | Playwright 跑时显示浏览器窗口 |
| `pnpm test:e2e:ui` | Playwright 自带 UI 调试 |

`postinstall` 自动跑 `prisma generate`,本地 `pnpm install` 后即可工作。

**PostgreSQL** 起在 `docker-compose-environment.yml`(端口 5432,服务名 `town-store-postgres`,db 名 `town_store`)。CI 用 `postgres:16-alpine` service 容器,环境变量固定 `postgres/postgres`。

**烟测 + CI**:`scripts/smoke.sh` 是 bash + curl + python3 json 解析,走 HTTP 状态码 + JSON 形状断言。Playwright 真浏览器 E2E 在 `tests/e2e/`,断言 class / aria / 文案 / 交互,32+ 用例。CI 见 `.github/workflows/ci.yml`,目前只跑 smoke(后续 Task 12.3 加进来)。server-ready 探活最多 60s。

**Playwright 用法**:`pnpm exec playwright install chromium chromium-headless-shell`(首次)。Playwright 配置默认自带 webServer 拉起生产构建,跑完即销毁;调试时可传 `BASE_URL=http://localhost:3000` 复用现有 dev。

## 架构要点

### 1. Server page → Client component handoff

每个路由都是 **async server component**,在服务端做 Prisma 取数(零网络跳 + 不会暴露敏感字段给 client bundle),然后把序列化的数据传给标记 `"use client"` 的子组件做交互。

例子:
- `app/dashboard/page.tsx` 是 server,内联 4 个 KPI/section 容器。
- `components/product-form.tsx`、`components/sale-pos.tsx`、`components/ui/theme-toggle.tsx`、`components/ui/delete-product-button.tsx` 是 client。

新增交互性表单/弹窗/异步操作请建在 `src/components/` 下,用 `"use client"` 声明。

### 2. Prisma 7 配置(非默认)

`prisma.config.ts` 显式声明 `schema`、`migrations`、`seed` 路径,Prisma client **输出到自定义位置** `src/generated/prisma/client` 而不是默认的 `@prisma/client`。所有 Prisma 引用都写:

```ts
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client"; // 类型
```

`lib/prisma.ts` 的 client 单例在 dev 复用 `globalThis` 防 hot-reload 创建多实例。**改完 `prisma/schema.prisma` 必须跑 `pnpm prisma:generate` 然后 `pnpm tsc --noEmit` 确认类型。**

### 3. Decimal ↔ String 边界

Prisma `Decimal(10,2)` 经 API 序列化为 JSON 字符串传到客户端(避免 IEEE 754 精度问题)。从 client 提交时也用 `parseFloat` → `Math.round(x*100)/100`。展示统一走 `lib/format.ts` 的 `formatPrice(value)` / `formatDate()` / `formatDateTime()` / `daysUntil()`。**不要在 client 手写 `Intl.NumberFormat` 或 `new Date().toLocaleString()`,保证所有金额/日期视觉一致。**

### 4. API 错误契约

后端路由(`src/app/api/**/route.ts`)用 `lib/api.ts` 的三个 helper:
- `handleZodError(err)` → 422 + `VALIDATION_ERROR` + 每字段错误数组
- `apiError(message, status, code, fields?)` → 任意错误
- `prismaErrorStatus(code)` → P2002→409、P2025→404 等

业务级 throws 用路由内 `class HttpError extends Error { status, code, fields }` 携带状态码。

Client 端解析约定:`body.error.message`(顶层 banner)+ `body.error.fields` 里 `{ "<inputName>": ["msg",...] }`(字段下方红字)。**保持这套契约,SalePos/ProductForm 现有逻辑就是这样消费错误的,前端组件不要做额外的字段猜测。**

### 5. 视觉系统(2026-07 重塑后)

所有 UI 复用 `src/components/ui/` 下这套组件库,**不要在内联页面里重写空状态/KPI 卡/表单 section**:

- `PageHeader` — 标题 + 描述 + backHref + actions slot
- `StatCard` — KPI 卡,所有金额走 `font-serif tnum`(账本式排版)
- `SectionCard` — 带头部(icon + title + count + 可选 headerAction)+ body + 可选 footer
- `EmptyState` — 统一空状态(替换原先散落的 3 套不同写法)
- `Pill` — tone × variant 的徽章(tone: neutral/positive/warning/danger/accent)
- `Field`(`FieldSection` / `FieldGrid` / `Field` / `inputClass`) — 表单字段一致性
- `LoadingView` / `RouteError` — 每个路由段 `loading.tsx` / `error.tsx` 复用

**新增页面/字段时必须走这套组件**,不要复制粘贴 section 或 KPI 卡的 Tailwind 字符串;色板变化也只改 `globals.css` 的 `@theme` token。

Shell(侧栏 + 移动抽屉)active 态来自 `usePathname()` + `components/nav-items.ts` 共享的 `NAV_ITEMS`(看板 / 快速查价 / 商品管理 / 销售记录)。新增顶级导航项请同时改 `nav-items.ts` 一处,**sidebar 和 mobile-nav 自动同步。**

### 6. 暗色模式

`globals.css` 用 `@custom-variant dark (&:where(.dark, .dark *))`,所有色通过 `--color-canvas` / `--color-surface` / `--color-ink` 等 token 在 `:root` / `.dark` 下重定义。`<html>` 加 `class="dark"` 即切。`layout.tsx` 注入的内联 `themeScript` 在 hydration 前根据 `localStorage('theme')` 设置 class,防 FOUC。`ui/theme-toggle.tsx` 用 `useSyncExternalStore` + `MutationObserver`,**不要再写 `useEffect(()=>setMounted(true),[])` 这类会引起 cascading-render lint 报警的模式**。

### 7. 路由段必须有 `loading.tsx` + `error.tsx`

每个路由段都应配:

```ts
// loading.tsx
import { LoadingView } from "@/components/ui/loading-view";
export default function Loading() { return <LoadingView label="..." />; }

// error.tsx
"use client";
import { RouteError } from "@/components/ui/route-error";
export default function Error(p: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError title="..." homeHref="..." {...p} />;
}
```

新增路由请同时建这两个文件。

## 约定

- **UI 语言**:中文(`lang="zh-CN"`),代码标识符英文。toast、表单提示、empty 文案都中文。
- **Commit message**:Chinese Conventional Commits(`feat(ui): ...`、`fix(api): ...`)。scope 自取。
- **测试**:每个任务完成时把烟测/手测用例追加到 [`docs/testing.md`](docs/testing.md)(已有 Task 1–11)。脚本例在 [`scripts/smoke.sh`](scripts/smoke.sh)。
- **Valibot / Zod 校验**:在 `lib/validators/{product,sale}.ts` 维护 schema,前后端共用同一文件,API route 与表单都从这里取校验逻辑。**改字段必同步两端。**
- **Datetime**:服务端 UTC,客户端用 `formatDate`/`formatDateTime`(本地化输出)。**不要把 `new Date().toLocaleString()` 散落到组件里。**
- **Dexie**:无;无 client 持久化;无 SW;无 service worker。所有状态在 server-only(Prisma)或 React state。

## 已知不在范围(MVP)

无认证、无 multi-tenant、无产品图片上传、无条形码扫描库、无图表库、无 customer-facing 路由。后续阶段的 AI 助手/小程序端/特价活动管理都没有入口。这些功能若临时需要,先建 issue 后再说,不要在 MVP 上硬塞。

## 相关文档

- [README.md](README.md) — 产品定位 + 本地开发 + 后续阶段路线
- [docs/testing.md](docs/testing.md) — Task 1–12 烟测矩阵 + CI 流程
- [docs/data-model.md](docs/data-model.md) — `Product` / `Sale` / `SaleItem` / `StockMovement` 字段与约束(改 Prisma schema 前后读一下)
- [docs/product-plan.md](docs/product-plan.md) — 业务流程说明
- [.github/workflows/ci.yml](.github/workflows/ci.yml) — CI 流程
- [tests/e2e/](tests/e2e/) — Playwright 真实浏览器测试(visual + api,33 用例)
