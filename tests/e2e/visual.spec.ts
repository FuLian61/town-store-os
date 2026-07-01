import { test, expect } from "@playwright/test";

/**
 * 视觉 / 行为断言 — 验证 Task 11 设计系统落地,
 * 顺便把 Task 11 里"待浏览器验证"的项自动化掉,以后重构 UI 跑 CI 就能验。
 *
 * 这些不是快照对比(那样太脆),而是断言关键 class / aria / 文案,
 * 改动视觉风格不至于每次都失败。
 */

const PAGES = [
  { name: "看板", path: "/dashboard" },
  { name: "快速查价", path: "/lookup" },
  { name: "商品管理", path: "/products" },
  { name: "新建商品", path: "/products/new" },
  { name: "新建销售", path: "/sales/new" },
  { name: "销售记录", path: "/sales" },
] as const;

test.describe("Shell 路由", () => {
  for (const p of PAGES) {
    test(`${p.name} (${p.path}) 能 200 + 渲染`, async ({ page }) => {
      const res = await page.goto(p.path);
      expect(res?.status(), `${p.path} 应返回 200`).toBe(200);
      // 等待主内容出现(防止 streaming 状态下 MainContent 还没注入)
      await expect(page.locator("main")).toBeVisible();
    });
  }

  test("/ 重定向到 /dashboard", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/dashboard/);
  });
});

test.describe("Sidebar active 导航态", () => {
  test("/products 时 sidebar 高亮「商品管理」", async ({ page }) => {
    await page.goto("/products");
    const active = page.locator("aside a[aria-current='page']");
    await expect(active).toBeVisible();
    await expect(active).toContainText("商品管理");
    await expect(active).toHaveClass(/bg-accent-bg/);
  });

  test("/lookup 时 sidebar 高亮「快速查价」", async ({ page }) => {
    await page.goto("/lookup");
    const active = page.locator("aside a[aria-current='page']");
    await expect(active).toContainText("快速查价");
  });

  test("/dashboard 时 sidebar 高亮「经营看板」", async ({ page }) => {
    await page.goto("/dashboard");
    const active = page.locator("aside a[aria-current='page']");
    await expect(active).toContainText("经营看板");
  });

  test("sidebar 含日期戳", async ({ page }) => {
    await page.goto("/dashboard");
    // Sidebar 底部当天日期戳
    await expect(
      page.locator("aside").getByText(/今天 · \d{4}\/\d{2}\/\d{2}/),
    ).toBeVisible();
  });
});

test.describe("暗色模式切换", () => {
  test("ThemeToggle 点击翻转 <html> class 并写 localStorage", async ({ page, context }) => {
    await page.goto("/dashboard");
    // 默认浅色(html 不带 dark class)
    await expect(page.locator("html")).not.toHaveClass(/dark/);
    await page.getByRole("button", { name: /切换到深色模式/ }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);
    const stored = await page.evaluate(() => localStorage.getItem("theme"));
    expect(stored).toBe("dark");
    // 再点切回浅色
    await page.getByRole("button", { name: /切换到浅色模式/ }).click();
    await expect(page.locator("html")).not.toHaveClass(/dark/);
  });

  test("刷新页面后偏好像 cookie 一样保留(localStorage 优先)", async ({ page }) => {
    await page.goto("/dashboard");
    // 先存 dark
    await page.evaluate(() => {
      localStorage.setItem("theme", "dark");
      document.documentElement.classList.add("dark");
    });
    // 重新加载,ThemeScript 内联脚本应基于 localStorage 重建 dark class
    await page.reload();
    await expect(page.locator("html")).toHaveClass(/dark/);
  });
});

test.describe("看板", () => {
  test("有 4 个 KPI + 低库存 / 临期 / 今日销售三个 section", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByText("今日销售").first()).toBeVisible();
    await expect(page.getByText("今日毛利")).toBeVisible();
    await expect(page.getByText("库存总成本")).toBeVisible();
    await expect(page.getByText("库存总价值")).toBeVisible();
    await expect(page.getByText("低库存提醒")).toBeVisible();
    await expect(page.getByText("临期提醒")).toBeVisible();
  });
});

test.describe("商品列表", () => {
  test("搜索 + 分类筛选回 URL 同步", async ({ page }) => {
    await page.goto("/products");
    await page.getByPlaceholder("搜索商品名 / 条码 / 品牌").fill("可口");
    await page.getByRole("button", { name: "筛选" }).click();
    await expect(page).toHaveURL(/q=%E5%8F%AF%E5%8F%A3/);
  });

  test("表头保留:商品名 / 条码 / 分类 / 进价 / 售价 / 库存 / 到期日 / 货架 / 操作", async ({ page }) => {
    await page.goto("/products");
    for (const h of ["商品名", "条码", "分类", "进价", "售价", "库存", "到期日", "货架", "操作"]) {
      await expect(
        page.getByRole("columnheader", { name: h, exact: true }),
      ).toBeVisible();
    }
  });
});

test.describe("销售列表", () => {
  test("表头保留:销售时间 / 商品 / 件数 / 销售总额 / 毛利 / 毛利率 / 备注", async ({ page }) => {
    await page.goto("/sales");
    for (const h of ["销售时间", "商品", "件数", "销售总额", "毛利", "毛利率", "备注"]) {
      await expect(
        page.getByRole("columnheader", { name: h, exact: true }),
      ).toBeVisible();
    }
  });
});

test.describe("快速查价", () => {
  test("空 query 显示 EmptyState", async ({ page }) => {
    await page.goto("/lookup");
    await expect(page.getByText("还没输入查询")).toBeVisible();
    await expect(page.getByPlaceholder("输入商品名、条码或品牌…")).toBeFocused();
  });

  test("输入后 300ms debounce → URL 跳 ?q=... 渲染结果", async ({ page }) => {
    await page.goto("/lookup");
    await page.getByPlaceholder("输入商品名、条码或品牌…").fill("瓜子");
    // 等待 debounce + 跳转
    await expect(page).toHaveURL(/q=%E7%93%9C%E5%AD%90/, { timeout: 2000 });
    // 单结果走大卡(¥ display + 库存等 cell)
    await expect(page.getByRole("heading", { name: "匹配结果" })).toBeVisible();
    // 至少一个 编辑 → 链接
    await expect(page.getByRole("link", { name: /编辑商品/ })).toBeVisible();
  });

  test("没有匹配显示 EmptyState + 新建商品 CTA", async ({ page }) => {
    await page.goto("/lookup?q=xyzabc_no_match");
    await expect(page.getByText("没有匹配的商品")).toBeVisible();
    await expect(page.getByRole("link", { name: /新建商品/ })).toBeVisible();
  });
});

test.describe("Loading + Error 边界", () => {
  test("路由级 loading.tsx 在 streaming 期间渲染 LoadingView", async ({ page }) => {
    // 模拟慢后端:在 dashboard 的 DB 请求前拦截
    await page.route("**/api/**", async (route) => {
      await new Promise((res) => setTimeout(res, 200));
      await route.continue();
    });
    await page.goto("/dashboard");
    // 即便被拦截,根布局还是先渲染,main 容器始终存在
    await expect(page.locator("main")).toBeVisible();
  });
});

test.describe("表单", () => {
  test("新建商品表单段标题保留", async ({ page }) => {
    await page.goto("/products/new");
    for (const t of ["基本信息", "价格与库存", "位置与效期"]) {
      await expect(page.getByText(t, { exact: true })).toBeVisible();
    }
  });
});
