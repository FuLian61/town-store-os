import { test, expect } from "@playwright/test";

/**
 * API 行为 E2E — 互补 smoke.sh,做 POST 实际发请求,
 * 验证 raw curl 可能漏掉的 boundary 行为。
 */

test.describe("API 烟测", () => {
  test("GET /api/products 返回产品列表", async ({ request }) => {
    const res = await request.get("/api/products");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.products)).toBe(true);
  });

  test("POST /api/products 缺失 name 返回 422 + VALIDATION_ERROR", async ({ request }) => {
    const res = await request.post("/api/products", {
      data: { name: "", category: "x", costPrice: 1, salePrice: 2 },
    });
    expect(res.status()).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.fields.name).toBeDefined();
  });

  test("POST /api/products salePrice < costPrice 返回 422", async ({ request }) => {
    const res = await request.post("/api/products", {
      data: { name: "测试价", category: "x", costPrice: 5, salePrice: 3 },
    });
    expect(res.status()).toBe(422);
  });

  test("POST /api/sales 空 items 返回 422", async ({ request }) => {
    const res = await request.post("/api/sales", {
      data: { items: [] },
    });
    expect(res.status()).toBe(422);
  });

  test("GET / 不返回 HTML,重定向到 /dashboard", async ({ request }) => {
    const res = await request.get("/", { maxRedirects: 0 });
    expect([301, 302, 303, 307, 308]).toContain(res.status());
    expect(res.headers().location).toBe("/dashboard");
  });
});
