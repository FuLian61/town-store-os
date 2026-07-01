# 测试用例与烟测脚本

> 本文档记录 town-store-os 已完成模块的烟测（Smoke Test）用例。
> 每完成一个任务，在这里追加新的小节，方便回归和交接。
> 集成测试和单元测试留到 MVP 验收之后再补；这里只覆盖"黑盒 API + 关键页面"的端到端验证。

## 通用前置条件

```bash
# 1. 启动 PostgreSQL
docker compose -f docker-compose-environment.yml up -d
docker exec town-store-postgres psql -U postgres -d town_store -c "SELECT 1"

# 2. 启动 Next.js
pnpm dev

# 3. 种子数据（如数据库为空）
# 见 docs/seed.md（待补）；当前测试用的是 psql 直插的 10 条商品
```

---

## Task 1 · Prisma 客户端单例

**目标**：验证 `src/lib/prisma.ts` 在 dev 模式下复用 globalThis 上的实例，能正确连接数据库。

```bash
npx tsx -e "(async () => { const { prisma } = await import('./src/lib/prisma'); const c = await prisma.product.count(); console.log('product count:', c); await prisma.\$disconnect(); })();"
```

| # | 用例 | 期望 | 实际 |
|---|---|---|---|
| 1.1 | 数据库连接 | 输出 product count（0 或更多） | ✅ 0 |

---

## Task 2 · 商品 CRUD API

**目标**：验证 `/api/products` 全部端点。

### 2.1 GET 列表

```bash
curl -s http://localhost:3000/api/products
```

| # | 用例 | 期望 | 实际 |
|---|---|---|---|
| 2.1.1 | 空列表 | `{"products":[]}` | ✅ |
| 2.1.2 | 搜索 q=可乐 | 只命中含"可乐"的商品 | ✅ |
| 2.1.3 | category=饮料 | 只命中饮料分类 | ✅ |
| 2.1.4 | q + category 组合 | AND 关系 | ✅ |

### 2.2 POST 创建

```bash
curl -s -X POST http://localhost:3000/api/products \
  -H "Content-Type: application/json" \
  -d '{"name":"可口可乐 330ml","category":"饮料","brand":"可口可乐","spec":"330ml","costPrice":2.50,"salePrice":3.50,"stock":24,"lowStockThreshold":6,"shelfLocation":"A-1-3","expiryDate":"2026-09-15T00:00:00Z"}'
```

| # | 用例 | 期望 | 实际 |
|---|---|---|---|
| 2.2.1 | 合法创建（库存 24） | 201 + product + 1 条 INBOUND 流水 | ✅ |
| 2.2.2 | 空 name | 422 + `name: 商品名不能为空` | ✅ |
| 2.2.3 | 售价 < 进价 | 422 + `salePrice: 售价应大于等于进价` | ✅ |
| 2.2.4 | 重复 barcode | 409 + `DUPLICATE_BARCODE` | ✅ |

### 2.3 GET 详情

```bash
curl -s http://localhost:3000/api/products/$ID
```

| # | 用例 | 期望 | 实际 |
|---|---|---|---|
| 2.3.1 | 存在 ID | 200 + product + `_count: {saleItems, stockMovements}` | ✅ |
| 2.3.2 | 不存在 ID | 404 + `NOT_FOUND` | ✅ |

### 2.4 PATCH 更新

```bash
curl -s -X PATCH http://localhost:3000/api/products/$ID \
  -H "Content-Type: application/json" \
  -d '{"salePrice":3.80}'
```

| # | 用例 | 期望 | 实际 |
|---|---|---|---|
| 2.4.1 | 只改价格 | 200 + product，不写流水 | ✅ |
| 2.4.2 | 改库存（24→18） | 200 + 1 条 ADJUSTMENT 流水（quantity=-6, before=24, after=18） | ✅ |
| 2.4.3 | 部分更新 salePrice<costPrice | 422 + `salePrice: 售价应大于等于进价`（**合并现有值校验**） | ✅ |
| 2.4.4 | 部分更新 costPrice>当前 salePrice | 422 + 字段错误 | ✅ |
| 2.4.5 | 重复 barcode | 409 + `DUPLICATE_BARCODE` | ✅ |

> **回归要点**：单字段 PATCH 必须合并现有值后再校验 `salePrice >= costPrice`。初版有 bug，见 commit `1e1c78d`。

### 2.5 DELETE 删除

```bash
curl -s -X DELETE http://localhost:3000/api/products/$ID -w "status=%{http_code}\n"
```

| # | 用例 | 期望 | 实际 |
|---|---|---|---|
| 2.5.1 | 无销售历史 | 204 + StockMovement 级联清空 | ✅ |
| 2.5.2 | 不存在 ID | 404 + `NOT_FOUND` | ✅ |
| 2.5.3 | 有 SaleItem 引用 | 409 + `PRODUCT_HAS_HISTORY`（待 Sales API 上线后验证） | 待测 |

---

## Task 3 · 商品列表页

**目标**：浏览器访问 `/products` 验证渲染。

### 3.1 表格渲染

```bash
curl -s http://localhost:3000/products | grep -c '<tr '
```

| # | 用例 | 期望 | 实际 |
|---|---|---|---|
| 3.1.1 | 10 条种子数据 | 表格 11 行（含表头） | ✅ |
| 3.1.2 | 低库存 amber 徽章（蒙牛 stock=4 ≤ 6） | `bg-amber-100` class | ✅ |
| 3.1.3 | 低库存徽章（双汇 stock=2 ≤ 6） | `bg-amber-100` class | ✅ |
| 3.1.4 | 7 天内到期 amber（蒙牛 2026-07-05 = 4 天） | `text-amber-600` class | ✅ |
| 3.1.5 | 7 天内到期 amber（双汇 2026-07-02 = 1 天） | `text-amber-600` class | ✅ |
| 3.1.6 | 过期商品 red | `text-red-600` class | 无种子数据覆盖，待补 |

### 3.2 搜索与筛选

| # | 用例 | URL | 期望 | 实际 |
|---|---|---|---|---|
| 3.2.1 | 模糊搜索 | `?q=可口` | 只命中可口可乐 | ✅ |
| 3.2.2 | 分类筛选 | `?category=饮料` | 命中 3 条饮料 | ✅ |
| 3.2.3 | 组合筛选 | `?q=可乐&category=饮料` | 命中 2 条（可口+百事） | ✅ |
| 3.2.4 | 无匹配 | `?q=xyzabc` | 显示"没有匹配的商品" | ✅ |
| 3.2.5 | 表单 method=GET | `/products` action | URL 同步 | ✅ |

---

## Task 4 · 商品表单

**目标**：浏览器访问 `/products/new` 和 `/products/{id}/edit`。

### 4.1 新建页

```bash
curl -s -o /dev/null -w "status=%{http_code}\n" http://localhost:3000/products/new
```

| # | 用例 | 期望 | 实际 |
|---|---|---|---|
| 4.1.1 | 页面渲染 | 200 + 4 个段标题（基本信息/价格与库存/位置与效期/创建商品） | ✅ |

### 4.2 编辑页

```bash
curl -s -o /dev/null -w "status=%{http_code}\n" http://localhost:3000/products/$ID/edit
```

| # | 用例 | 期望 | 实际 |
|---|---|---|---|
| 4.2.1 | 合法 ID | 200 + 字段预填（input value=） | ✅ |
| 4.2.2 | 不存在 ID | 404 | ✅ |
| 4.2.3 | 预填值类型正确 | Decimal → string、Date → YYYY-MM-DD | ✅ |

### 4.3 提交（API 路径同 2.2/2.4）

| # | 用例 | 期望 | 实际 |
|---|---|---|---|
| 4.3.1 | 创建成功 | toast "商品已创建" + 跳转 `/products` | 待浏览器验证 |
| 4.3.2 | 字段错误 | 字段下方红字提示 | 待浏览器验证 |
| 4.3.3 | 顶层错误 | 顶部红色 banner | 待浏览器验证 |

> 浏览器端验证需要人工执行（Sonner toast、客户端校验提示、加载态）。截图留到验收阶段。

---

## Task 5 · 销售开单 API

**目标**：验证 `POST /api/sales` 单事务创建销售 + 扣库存 + 写流水。

### 5.1 正常销售

```bash
curl -s -X POST http://localhost:3000/api/sales \
  -H "Content-Type: application/json" \
  -d '{"items":[{"productId":"p1","quantity":3},{"productId":"p3","quantity":2}],"note":"测试销售"}'
```

| # | 用例 | 期望 | 实际 |
|---|---|---|---|
| 5.1.1 | 合法 3+2 件销售 | 201 + totalAmount=14.5, totalCost=10.5, totalProfit=4, itemCount=5 | ✅ |
| 5.1.2 | 库存正确扣减 | p1: 24→21, p3: 60→58 | ✅ |
| 5.1.3 | 流水正确写入 | 2 条 SALE_OUT（quantity=-3, -2；beforeStock/afterStock 正确） | ✅ |

### 5.2 错误场景

| # | 用例 | 入参 | 期望 | 实际 |
|---|---|---|---|---|
| 5.2.1 | 库存不足 | `[{p6,10}]`（p6 库存仅 2） | 422 + `INSUFFICIENT_STOCK` + `items.p6: 双汇火腿肠 40g 库存不足（剩余 2，需 10）` | ✅ |
| 5.2.2 | 商品不存在 | `[{p999,1}]` | 422 + `items.p999: 商品不存在: p999` | ✅ |
| 5.2.3 | 空 items | `{items:[]}` | 422 + `items: 销售明细不能为空` | ✅ |
| 5.2.4 | 负数数量 | `[{p1,-1}]` | 422 + `items.0.quantity: 数量必须大于 0` | ✅ |

### 5.3 业务逻辑

| # | 用例 | 入参 | 期望 | 实际 |
|---|---|---|---|---|
| 5.3.1 | 同商品聚合 | `[{p1,1},{p1,1}]` | itemCount=2, totalAmount=7 (= 2×3.5) | ✅ |
| 5.3.2 | **事务原子性** | `[{p1,2},{p6,10}]`（p6 失败） | 全部回滚：p1 库存不变、Sale 表无新行、StockMovement 无新行 | ✅ p1 stock 19→19, sales 2→2, movements 3→3 |

### 5.4 GET 列表

```bash
curl -s http://localhost:3000/api/sales
```

| # | 用例 | 期望 | 实际 |
|---|---|---|---|
| 5.4.1 | 全部 | 按 soldAt desc，含 items + product | ✅ |
| 5.4.2 | from=昨天 | 0 条 | ✅ |
| 5.4.3 | from=今天 | 含今天所有销售 | ✅ |
| 5.4.4 | limit=1 | 1 条 | ✅ |

---

## 待补

- [x] Task 6（销售开单页）—— 见上
- [x] Task 7（销售列表/详情页）—— 见上
- [x] Task 8（经营看板）—— 见上
- [x] Task 9（全局导航 + 首页）—— 见下
- [ ] Task 10 完成后追加对应小节
- [ ] 浏览器端验证（UI 截图）—— 验收阶段补
- [ ] 集成测试 / 单元测试 —— MVP 验收后补
- [ ] 性能 / 压测 —— 留到第二阶段

---

## Task 9 · 全局导航 + 首页

**目标**：左右布局（桌面）/ 顶栏+抽屉（移动），首页重定向到看板。

### 9.1 路由与重定向

```bash
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" http://localhost:3000/
```

| # | 用例 | 期望 | 实际 |
|---|---|---|---|
| 9.1.1 | `/` | 307 → /dashboard | ✅ |
| 9.1.2 | 所有原页面仍可访问 | /products, /sales, /sales/new, /products/new, /products/{id}/edit, /sales/{id}, /dashboard 全 200 | ✅ |

### 9.2 桌面端 sidebar

| # | 用例 | 期望 | 实际 |
|---|---|---|---|
| 9.2.1 | Logo 区块 | "乡镇小店" + "town-store-os" 副标题 | ✅ |
| 9.2.2 | 导航链接 | 经营看板 / 商品管理 / 销售记录 | ✅ |
| 9.2.3 | 主操作 | 底部 "新建销售" 按钮（高对比） | ✅ |
| 9.2.4 | 版本标记 | "V0.1 · MVP" | ✅ |
| 9.2.5 | 桌面端显示 | md:flex fixed inset-y-0 w-60 | ✅ |

### 9.3 移动端导航

| # | 用例 | 期望 | 实际 |
|---|---|---|---|
| 9.3.1 | 顶栏 sticky | md:hidden，h-14，含 logo + 菜单按钮 | ✅ |
| 9.3.2 | 抽屉打开 | 点击菜单 → 半透明遮罩 + 侧滑抽屉 | 待浏览器验证 |
| 9.3.3 | 抽屉关闭 | 点击遮罩 / X 按钮 / 链接 | 待浏览器验证 |

### 9.4 交互（待人工验证）

| # | 用例 | 期望 |
|---|---|---|
| 9.4.1 | 点击 sidebar Logo | 回 dashboard |
| 9.4.2 | 点击 sidebar 导航 | 跳转对应页 |
| 9.4.3 | 点击"新建销售" | 跳 /sales/new |
| 9.4.4 | 移动端打开抽屉 → 选导航 | 跳转 + 抽屉自动关闭 |
| 9.4.5 | 窗口宽度从 1024 拉到 600 | sidebar 隐藏、顶栏出现 |

---

## Task 8 · 经营看板 `/dashboard`

**目标**：店主进入首屏就能看到关键经营数据。

### 8.1 页面渲染

```bash
curl -s -o /tmp/dashboard.html -w "status=%{http_code}\n" http://localhost:3000/dashboard
```

| # | 用例 | 期望 | 实际 |
|---|---|---|---|
| 8.1.1 | 页面状态 | 200 | ✅ |
| 8.1.2 | KPI 4 卡 | 今日销售/今日毛利/库存总成本/库存总价值 | ✅ |
| 8.1.3 | 低库存提醒 section | 蒙牛、双汇 出现 | ✅ |
| 8.1.4 | 临期提醒 section | 7 天分组显示 | ✅ |
| 8.1.5 | 今日销售 section | 含今日销售明细 | ✅ |

### 8.2 数据正确性

| # | 用例 | 期望 | 实际 |
|---|---|---|---|
| 8.2.1 | 今日销售额 | ¥33.5（3 笔合计） | ✅ |
| 8.2.2 | 今日毛利 | ¥9.8（3.8+4+2） | ✅ |
| 8.2.3 | 库存总成本 | sum(stock × costPrice) | ✅（¥1113.30） |
| 8.2.4 | 库存总价值 | sum(stock × salePrice) | ✅（¥1573.00） |
| 8.2.5 | 低库存商品 | stock ≤ lowStockThreshold | ✅（蒙牛 4/6、双汇 2/6） |
| 8.2.6 | 7 天内到期 | 蒙牛 4 天、双汇 1 天 | ✅ |

### 8.3 交互（待人工验证）

| # | 用例 | 期望 |
|---|---|---|
| 8.3.1 | 低库存列表项点击 | 跳转到 `/products/[id]/edit` |
| 8.3.2 | 临期商品点击 | 跳转到 `/products/[id]/edit` |
| 8.3.3 | 今日销售行点击 | 跳转到 `/sales/[id]` |
| 8.3.4 | "查看全部" → 销售列表 | 跳转到 `/sales` |
| 8.3.5 | "去管理商品" → 商品列表 | 跳转到 `/products` |

---

## Task 7 · 销售列表/详情页

**目标**：`/sales` 销售列表（日期筛选 + 汇总），`/sales/[id]` 小票式详情。

### 7.1 列表页 `/sales`

```bash
curl -s -o /dev/null -w "status=%{http_code}\n" http://localhost:3000/sales
curl -s http://localhost:3000/sales | python3 -c "import sys,re; print(re.findall(r'.{5}共.{15}', sys.stdin.read()))"
```

| # | 用例 | 期望 | 实际 |
|---|---|---|---|
| 7.1.1 | 页面状态 | 200 | ✅ |
| 7.1.2 | 无筛选 | "共 3 条" + 3 行 | ✅ |
| 7.1.3 | from=昨天 to=昨天 | "所选时间段没有销售记录" | ✅ |
| 7.1.4 | from=今天 to=今天 | "共 3 条" | ✅ |
| 7.1.5 | 汇总卡片 4 项 | 销售总额/总毛利/平均毛利率/单数 | ✅ |
| 7.1.6 | 日期筛选 GET form | URL 同步 | ✅ |

### 7.2 详情页 `/sales/[id]`

```bash
SALE_ID=$(curl -s http://localhost:3000/api/sales | python3 -c "import json,sys; print(json.load(sys.stdin)['sales'][0]['id'])")
curl -s "http://localhost:3000/sales/$SALE_ID"
```

| # | 用例 | 期望 | 实际 |
|---|---|---|---|
| 7.2.1 | 合法 ID | 200 + 三段式（销售单/商品明细/库存变化） | ✅ |
| 7.2.2 | 销售总额/成本/毛利 | 三栏正确（带毛利率百分比） | ✅ |
| 7.2.3 | 商品明细表格 | 含售价/数量/小计/毛利 | ✅ |
| 7.2.4 | 库存变化 section | SALE_OUT 流水正确 | ✅ |
| 7.2.5 | 备注显示 | "POS 模拟" 出现在头部 | ✅ |
| 7.2.6 | 不存在 ID | 404 | ✅ |

### 7.3 浏览器交互（待人工验证）

| # | 用例 | 期望 |
|---|---|---|
| 7.3.1 | 列表行点击 › 图标 | 跳转到 `/sales/[id]` |
| 7.3.2 | 详情页商品名点击 | 跳转到 `/products/[id]/edit` |
| 7.3.3 | 日期筛选表单 | 选择日期 → 提交 → URL 更新 + 表格刷新 |

---

## Task 6 · 销售开单页 `/sales/new`

**目标**：POS 式销售开单，左侧商品网格 + 右侧购物车。

### 6.1 页面渲染

```bash
curl -s -o /tmp/sales-new.html -w "status=%{http_code}\n" http://localhost:3000/sales/new
```

| # | 用例 | 期望 | 实际 |
|---|---|---|---|
| 6.1.1 | 页面状态 | 200 | ✅ |
| 6.1.2 | 10 件商品全部展示 | 10 个商品名各出现 1 次 | ✅ |
| 6.1.3 | 价格 ¥ 渲染 | 每个商品卡片有 ¥xx.xx | ✅（10 次 ¥） |
| 6.1.4 | 空购物车状态文案 | "点击左侧商品加入购物车" | ✅ |
| 6.1.5 | 搜索框 placeholder | "搜索商品名 / 品牌 / 规格" | ✅ |
| 6.1.6 | 库存为 0 商品不显示 | 仅显示 stock > 0 商品 | ✅（服务端过滤） |

### 6.2 端到端流程（API 模拟页面提交）

```bash
curl -s -X POST http://localhost:3000/api/sales \
  -H "Content-Type: application/json" \
  -d '{"items":[{"productId":"p2","quantity":1},{"productId":"p7","quantity":1}],"note":"POS 模拟"}'
```

| # | 用例 | 期望 | 实际 |
|---|---|---|---|
| 6.2.1 | 成功创建 | totalAmount=12, profit=3.8 | ✅ |
| 6.2.2 | 数据库联动 | Sales +1, SALE_OUT 流水 +N | ✅ |

### 6.3 浏览器交互（待人工验证）

| # | 用例 | 期望 |
|---|---|---|
| 6.3.1 | 点击商品卡片 | 加入购物车，右栏出现该商品 |
| 6.3.2 | 数量 +/- 按钮 | 数量调整，金额实时变化 |
| 6.3.3 | 数量超过库存 | toast "库存仅剩 X 件"，不更新 |
| 6.3.4 | 搜索过滤 | 实时筛选商品网格 |
| 6.3.5 | 移除购物车商品 | 点击 X 按钮，商品从右栏消失 |
| 6.3.6 | 清空购物车 | 顶部"清空"按钮，重置状态 |
| 6.3.7 | 提交销售 | 调 POST /api/sales，成功后跳转到 `/sales/[id]` 并显示成功 toast |
| 6.3.8 | 提交失败（库存不足） | 顶部红色 banner 显示错误信息 |
| 6.3.9 | 商品 0 库存显示 | 商品卡片 disabled + 半透明 + "库存 0" |

---

## 已知 Bug 与修复历史

| commit | 问题 | 修复 |
|---|---|---|
| `1e1c78d` | PATCH 单字段时 `salePrice >= costPrice` 校验失效 | 合并现有值后再校验 |