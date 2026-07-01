# 数据模型设计

## 1. 设计原则

本项目的数据模型围绕“小超市真实经营闭环”设计：

```text
商品
→ 进货/库存增加
→ 销售/库存减少
→ 库存流水追踪变化
→ 看板统计经营结果
→ 临期和低库存触发运营动作
→ 后续开放给小程序和 AI 助手
```

第一阶段优先保证核心链路清晰：

- 商品是基础主数据。
- 销售单记录一次交易。
- 销售明细记录卖了哪些商品。
- 库存流水记录库存为什么变化。

## 2. 第一阶段核心表

### `products` 商品表

用于记录门店商品的基础信息、价格、库存和临期信息。

字段建议：

| 字段 | 类型 | 说明 |
|---|---|---|
| id | string/uuid | 商品 ID |
| barcode | string? | 条码，可为空 |
| name | string | 商品名 |
| category | string | 分类 |
| brand | string? | 品牌 |
| spec | string? | 规格，如 500ml、70g |
| costPrice | decimal | 进价 |
| salePrice | decimal | 售价 |
| stock | integer | 当前库存 |
| lowStockThreshold | integer | 低库存阈值 |
| shelfLocation | string? | 货架位置 |
| expiryDate | date? | 到期日期，第一阶段先用单日期 |
| createdAt | datetime | 创建时间 |
| updatedAt | datetime | 更新时间 |

业务规则：

- 售价应大于等于 0。
- 进价应大于等于 0。
- 库存不能小于 0，除非后续允许负库存。
- 当 `stock <= lowStockThreshold` 时，进入低库存提醒。
- 当 `expiryDate` 距当前日期小于设定天数时，进入临期提醒。

说明：

第一阶段为了降低复杂度，一个商品只记录一个到期日期。第二阶段引入 `product_batches` 后，可支持同一商品多个批次和多个到期日期。

### `sales` 销售单表

用于记录一次销售交易的汇总信息。

字段建议：

| 字段 | 类型 | 说明 |
|---|---|---|
| id | string/uuid | 销售单 ID |
| totalAmount | decimal | 销售总额 |
| totalCost | decimal | 总成本 |
| totalProfit | decimal | 总毛利 |
| itemCount | integer | 商品件数 |
| soldAt | datetime | 销售时间 |
| note | string? | 备注 |
| createdAt | datetime | 创建时间 |

业务规则：

- `totalAmount` 等于销售明细小计之和。
- `totalCost` 等于销售明细成本之和。
- `totalProfit = totalAmount - totalCost`。
- 创建销售单时应同步创建销售明细和库存流水。

### `sale_items` 销售明细表

用于记录一次销售中每个商品的数量、售价、成本和毛利。

字段建议：

| 字段 | 类型 | 说明 |
|---|---|---|
| id | string/uuid | 销售明细 ID |
| saleId | string/uuid | 关联销售单 |
| productId | string/uuid | 关联商品 |
| quantity | integer | 销售数量 |
| salePrice | decimal | 销售时单价 |
| costPrice | decimal | 销售时成本价 |
| subtotal | decimal | 小计 |
| profit | decimal | 毛利 |
| createdAt | datetime | 创建时间 |

业务规则：

- `subtotal = salePrice * quantity`。
- `profit = (salePrice - costPrice) * quantity`。
- 销售明细应保存销售时价格，避免商品后续调价影响历史销售数据。

### `stock_movements` 库存流水表

用于记录库存每一次变化，是库存可追溯的关键表。

字段建议：

| 字段 | 类型 | 说明 |
|---|---|---|
| id | string/uuid | 库存流水 ID |
| productId | string/uuid | 关联商品 |
| type | enum | 入库、销售出库、手动调整、退货、损耗 |
| quantity | integer | 变化数量，入库为正，出库为负 |
| beforeStock | integer | 变化前库存 |
| afterStock | integer | 变化后库存 |
| referenceType | string? | 来源类型，如 sale、purchase、manual |
| referenceId | string? | 来源记录 ID |
| note | string? | 备注 |
| createdAt | datetime | 创建时间 |

库存流水类型建议：

```text
INBOUND 入库
SALE_OUT 销售出库
ADJUSTMENT 手动调整
RETURN 退货
LOSS 损耗
```

业务规则：

- 商品库存变化必须写入库存流水。
- 销售出库时，`quantity` 使用负数。
- 入库时，`quantity` 使用正数。
- `afterStock = beforeStock + quantity`。

## 3. 第二阶段扩展表

### `suppliers` 供应商表

用于记录进货来源。

字段建议：

| 字段 | 类型 | 说明 |
|---|---|---|
| id | string/uuid | 供应商 ID |
| name | string | 供应商名称 |
| contactName | string? | 联系人 |
| phone | string? | 电话 |
| address | string? | 地址 |
| note | string? | 备注 |
| createdAt | datetime | 创建时间 |
| updatedAt | datetime | 更新时间 |

### `purchase_orders` 进货单表

用于记录一次进货。

字段建议：

| 字段 | 类型 | 说明 |
|---|---|---|
| id | string/uuid | 进货单 ID |
| supplierId | string/uuid? | 供应商 ID |
| totalAmount | decimal | 进货总额 |
| purchasedAt | datetime | 进货时间 |
| note | string? | 备注 |
| createdAt | datetime | 创建时间 |

### `purchase_items` 进货明细表

用于记录进货单中的商品。

字段建议：

| 字段 | 类型 | 说明 |
|---|---|---|
| id | string/uuid | 进货明细 ID |
| purchaseOrderId | string/uuid | 进货单 ID |
| productId | string/uuid | 商品 ID |
| quantity | integer | 进货数量 |
| costPrice | decimal | 进货单价 |
| expiryDate | date? | 到期日期 |
| subtotal | decimal | 小计 |
| createdAt | datetime | 创建时间 |

业务规则：

- 创建进货明细后，应增加商品库存。
- 应写入库存流水，来源为 `purchase`。

### `product_batches` 商品批次表

用于支持同一商品多个进货批次和多个到期日期。

字段建议：

| 字段 | 类型 | 说明 |
|---|---|---|
| id | string/uuid | 批次 ID |
| productId | string/uuid | 商品 ID |
| batchNo | string? | 批次号 |
| quantity | integer | 批次剩余库存 |
| costPrice | decimal | 批次进价 |
| expiryDate | date? | 批次到期日期 |
| receivedAt | datetime | 入库时间 |
| createdAt | datetime | 创建时间 |

业务规则：

- 临期管理应优先基于批次到期日期。
- 销售扣库存可按先进先出原则扣减批次库存。

### `promotions` 活动表

用于记录特价、临期清仓、整箱囤货等活动。

字段建议：

| 字段 | 类型 | 说明 |
|---|---|---|
| id | string/uuid | 活动 ID |
| title | string | 活动标题 |
| type | enum | 特价、临期、清仓、到货推荐 |
| startsAt | datetime | 开始时间 |
| endsAt | datetime? | 结束时间 |
| status | enum | 草稿、进行中、已结束 |
| channel | string? | 后台、小程序、微信群 |
| createdAt | datetime | 创建时间 |
| updatedAt | datetime | 更新时间 |

### `promotion_items` 活动商品表

用于记录活动中的商品和活动价。

字段建议：

| 字段 | 类型 | 说明 |
|---|---|---|
| id | string/uuid | 活动商品 ID |
| promotionId | string/uuid | 活动 ID |
| productId | string/uuid | 商品 ID |
| promotionPrice | decimal | 活动价 |
| limitQuantity | integer? | 限购数量 |
| note | string? | 备注 |

## 4. 小程序阶段扩展表

### `customers` 顾客表

用于记录小程序顾客。

字段建议：

| 字段 | 类型 | 说明 |
|---|---|---|
| id | string/uuid | 顾客 ID |
| nickname | string? | 昵称 |
| phone | string? | 手机号 |
| openId | string? | 微信 openId |
| createdAt | datetime | 创建时间 |
| updatedAt | datetime | 更新时间 |

### `reservations` 到店自提预留表

用于记录顾客在小程序提交的商品预留。

字段建议：

| 字段 | 类型 | 说明 |
|---|---|---|
| id | string/uuid | 预留 ID |
| customerId | string/uuid? | 顾客 ID |
| customerName | string? | 顾客姓名 |
| phone | string? | 手机号 |
| status | enum | 待确认、已确认、已自提、已取消 |
| totalAmount | decimal | 预估金额 |
| pickupNote | string? | 自提备注 |
| createdAt | datetime | 创建时间 |
| updatedAt | datetime | 更新时间 |

### `reservation_items` 预留明细表

字段建议：

| 字段 | 类型 | 说明 |
|---|---|---|
| id | string/uuid | 预留明细 ID |
| reservationId | string/uuid | 预留 ID |
| productId | string/uuid | 商品 ID |
| quantity | integer | 预留数量 |
| price | decimal | 预留时价格 |
| subtotal | decimal | 小计 |

业务规则：

- 第一版预留不一定扣库存，可只做“人工确认”。
- 后续可支持确认后锁定库存。

## 5. AI 阶段扩展表

### `ai_conversations` AI 对话表

用于保存店主与 AI 助手的问答历史。

字段建议：

| 字段 | 类型 | 说明 |
|---|---|---|
| id | string/uuid | 对话 ID |
| userId | string/uuid? | 用户 ID |
| question | text | 用户问题 |
| answer | text | AI 回答 |
| contextType | string? | 上下文类型 |
| createdAt | datetime | 创建时间 |

### `ai_insights` AI 建议表

用于保存 AI 生成的经营建议。

字段建议：

| 字段 | 类型 | 说明 |
|---|---|---|
| id | string/uuid | 建议 ID |
| type | enum | 补货、临期、经营日报、促销文案 |
| title | string | 建议标题 |
| inputSnapshot | json | 分析时使用的数据快照 |
| content | text | 建议内容 |
| accepted | boolean | 是否采纳 |
| createdAt | datetime | 创建时间 |

AI 建议类型建议：

```text
RESTOCK 补货建议
EXPIRY 临期处理
DAILY_REPORT 经营日报
PROMOTION_COPY 促销文案
BUSINESS_ANALYSIS 经营分析
```

### `ai_embeddings` AI 向量表

后期接入 pgvector 时使用。

字段建议：

| 字段 | 类型 | 说明 |
|---|---|---|
| id | string/uuid | 向量记录 ID |
| sourceType | string | 来源类型，如 product、promotion、insight |
| sourceId | string | 来源记录 ID |
| content | text | 原始文本 |
| embedding | vector | 向量 |
| createdAt | datetime | 创建时间 |

可用于：

- 经营建议历史检索
- 商品相似检索
- 活动案例检索
- 店主知识库问答

## 6. 核心关系

```text
products 1 - N sale_items
sales 1 - N sale_items

products 1 - N stock_movements

suppliers 1 - N purchase_orders
purchase_orders 1 - N purchase_items
products 1 - N purchase_items

products 1 - N product_batches

promotions 1 - N promotion_items
products 1 - N promotion_items

customers 1 - N reservations
reservations 1 - N reservation_items
products 1 - N reservation_items
```

## 7. 第一阶段 Prisma 模型草案

```prisma
model Product {
  id                String          @id @default(cuid())
  barcode           String?         @unique
  name              String
  category          String
  brand             String?
  spec              String?
  costPrice         Decimal         @db.Decimal(10, 2)
  salePrice         Decimal         @db.Decimal(10, 2)
  stock             Int             @default(0)
  lowStockThreshold Int             @default(5)
  shelfLocation     String?
  expiryDate        DateTime?
  createdAt         DateTime        @default(now())
  updatedAt         DateTime        @updatedAt

  saleItems         SaleItem[]
  stockMovements    StockMovement[]
}

model Sale {
  id          String     @id @default(cuid())
  totalAmount Decimal    @db.Decimal(10, 2)
  totalCost   Decimal    @db.Decimal(10, 2)
  totalProfit Decimal    @db.Decimal(10, 2)
  itemCount   Int
  soldAt      DateTime   @default(now())
  note        String?
  createdAt   DateTime   @default(now())

  items       SaleItem[]
}

model SaleItem {
  id        String   @id @default(cuid())
  saleId    String
  productId String
  quantity  Int
  salePrice Decimal  @db.Decimal(10, 2)
  costPrice Decimal  @db.Decimal(10, 2)
  subtotal  Decimal  @db.Decimal(10, 2)
  profit    Decimal  @db.Decimal(10, 2)
  createdAt DateTime @default(now())

  sale      Sale     @relation(fields: [saleId], references: [id])
  product   Product  @relation(fields: [productId], references: [id])
}

model StockMovement {
  id            String            @id @default(cuid())
  productId     String
  type          StockMovementType
  quantity      Int
  beforeStock   Int
  afterStock    Int
  referenceType String?
  referenceId   String?
  note          String?
  createdAt     DateTime          @default(now())

  product       Product           @relation(fields: [productId], references: [id])
}

enum StockMovementType {
  INBOUND
  SALE_OUT
  ADJUSTMENT
  RETURN
  LOSS
}
```

## 8. 关键实现注意事项

### 金额字段

金额不要使用浮点数。应使用数据库 decimal 类型，前端展示时再格式化。

### 历史价格

销售明细必须保存销售当时的售价和成本价，不能只引用商品当前价格。否则商品调价后，历史毛利会被污染。

### 库存一致性

创建销售单、销售明细、扣库存、写库存流水应放在同一个数据库事务中。

### 条码

条码可以为空，因为部分散装商品或小杂货可能没有条码。存在条码时应尽量唯一。

### 临期管理

第一阶段可以在 `products.expiryDate` 上做简单临期提醒。第二阶段引入 `product_batches` 后，再按批次精细管理。

### AI 查询安全

后续做自然语言问数时，不应让大模型直接执行任意 SQL。推荐做法：

```text
用户问题
→ AI 识别意图和参数
→ 后端使用预设查询模板查询数据库
→ 将查询结果交给 AI 总结
```

这样可以避免 SQL 注入、误删数据和越权查询。

