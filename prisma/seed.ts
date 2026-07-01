/**
 * Seed 演示数据：30 件真实商品，覆盖多种品类 / 价格 / 库存 / 效期场景。
 *
 * 执行：npx tsx prisma/seed.ts
 * 或通过 package.json 的 db:seed 脚本。
 *
 * 设计要点：
 * 1. 用 upsert + barcode 保证幂等：重复跑不会产生重复记录
 * 2. 包含 6 件低库存（库存 ≤ 阈值）用于触发 dashboard 提醒
 * 3. 包含 4 件 7 天内到期 / 1 件已过期 用于触发临期提示
 * 4. 价格、库存、效期尽量贴近真实小超市
 * 5. 不依赖外部数据，可离线运行
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// 演示商品：每项含条码（用于幂等 upsert）+ 全部展示字段
type Seed = {
  barcode: string;
  name: string;
  category: string;
  brand: string | null;
  spec: string | null;
  costPrice: number;
  salePrice: number;
  stock: number;
  lowStockThreshold: number;
  shelfLocation: string | null;
  expiryOffsetDays: number | null; // 距今天 N 天；null = 无保质期
};

function today(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

const PRODUCTS: Seed[] = [
  // ===== 饮料（6 件）=====
  { barcode: "6901234567001", name: "可口可乐 330ml", category: "饮料", brand: "可口可乐", spec: "330ml", costPrice: 2.50, salePrice: 3.50, stock: 48, lowStockThreshold: 12, shelfLocation: "A-1-1", expiryOffsetDays: 75 },
  { barcode: "6901234567002", name: "百事可乐 500ml", category: "饮料", brand: "百事", spec: "500ml", costPrice: 3.20, salePrice: 4.50, stock: 36, lowStockThreshold: 10, shelfLocation: "A-1-2", expiryOffsetDays: 50 },
  { barcode: "6901234567003", name: "农夫山泉 550ml", category: "饮料", brand: "农夫山泉", spec: "550ml", costPrice: 1.50, salePrice: 2.00, stock: 120, lowStockThreshold: 24, shelfLocation: "A-1-3", expiryOffsetDays: 365 },
  { barcode: "6901234567004", name: "怡宝纯净水 555ml", category: "饮料", brand: "怡宝", spec: "555ml", costPrice: 1.40, salePrice: 2.00, stock: 96, lowStockThreshold: 24, shelfLocation: "A-1-4", expiryOffsetDays: 540 },
  { barcode: "6901234567005", name: "康师傅冰红茶 500ml", category: "饮料", brand: "康师傅", spec: "500ml", costPrice: 2.80, salePrice: 4.00, stock: 30, lowStockThreshold: 8, shelfLocation: "A-2-1", expiryOffsetDays: 60 },
  { barcode: "6901234567006", name: "红牛维生素饮料 250ml", category: "饮料", brand: "红牛", spec: "250ml", costPrice: 5.50, salePrice: 7.50, stock: 24, lowStockThreshold: 6, shelfLocation: "A-2-2", expiryOffsetDays: 200 },

  // ===== 乳制品（4 件）=====
  { barcode: "6901234567011", name: "蒙牛纯牛奶 250ml", category: "乳制品", brand: "蒙牛", spec: "250ml", costPrice: 2.00, salePrice: 3.00, stock: 4, lowStockThreshold: 8, shelfLocation: "B-1-1", expiryOffsetDays: 4 },
  { barcode: "6901234567012", name: "伊利安慕希希腊酸奶 200g", category: "乳制品", brand: "伊利", spec: "200g", costPrice: 4.50, salePrice: 6.50, stock: 18, lowStockThreshold: 6, shelfLocation: "B-1-2", expiryOffsetDays: 12 },
  { barcode: "6901234567013", name: "光明优倍鲜牛奶 450ml", category: "乳制品", brand: "光明", spec: "450ml", costPrice: 7.50, salePrice: 11.00, stock: 12, lowStockThreshold: 4, shelfLocation: "B-1-3", expiryOffsetDays: 6 },
  { barcode: "6901234567014", name: "君乐宝酸奶 100g×6", category: "乳制品", brand: "君乐宝", spec: "100g×6", costPrice: 9.00, salePrice: 13.50, stock: 8, lowStockThreshold: 3, shelfLocation: "B-1-4", expiryOffsetDays: 18 },

  // ===== 零食（5 件）=====
  { barcode: "6901234567021", name: "奥利奥饼干 116g", category: "零食", brand: "奥利奥", spec: "116g", costPrice: 5.00, salePrice: 7.50, stock: 30, lowStockThreshold: 8, shelfLocation: "C-1-1", expiryOffsetDays: 120 },
  { barcode: "6901234567022", name: "三只松鼠夏威夷果 200g", category: "零食", brand: "三只松鼠", spec: "200g", costPrice: 18.00, salePrice: 28.00, stock: 16, lowStockThreshold: 4, shelfLocation: "C-1-2", expiryOffsetDays: 280 },
  { barcode: "6901234567023", name: "良品铺子肉松饼 480g", category: "零食", brand: "良品铺子", spec: "480g", costPrice: 22.00, salePrice: 32.00, stock: 10, lowStockThreshold: 3, shelfLocation: "C-1-3", expiryOffsetDays: 90 },
  { barcode: "6901234567024", name: "乐事原味薯片 70g", category: "零食", brand: "乐事", spec: "70g", costPrice: 3.80, salePrice: 5.50, stock: 45, lowStockThreshold: 10, shelfLocation: "C-2-1", expiryOffsetDays: 180 },
  { barcode: "6901234567025", name: "洽洽香瓜子 160g", category: "零食", brand: "洽洽", spec: "160g", costPrice: 6.50, salePrice: 9.50, stock: 22, lowStockThreshold: 6, shelfLocation: "C-2-2", expiryOffsetDays: 240 },

  // ===== 方便食品（3 件）=====
  { barcode: "6901234567031", name: "康师傅红烧牛肉面", category: "方便食品", brand: "康师傅", spec: "105g", costPrice: 3.00, salePrice: 4.50, stock: 60, lowStockThreshold: 12, shelfLocation: "D-1-1", expiryOffsetDays: 220 },
  { barcode: "6901234567032", name: "统一老坛酸菜牛肉面", category: "方便食品", brand: "统一", spec: "118g", costPrice: 3.20, salePrice: 4.50, stock: 48, lowStockThreshold: 12, shelfLocation: "D-1-2", expiryOffsetDays: 200 },
  { barcode: "6901234567033", name: "自热米饭 梅菜扣肉 315g", category: "方便食品", brand: "自嗨锅", spec: "315g", costPrice: 14.00, salePrice: 22.00, stock: 12, lowStockThreshold: 4, shelfLocation: "D-1-3", expiryOffsetDays: 360 },

  // ===== 肉制品（3 件）=====
  { barcode: "6901234567041", name: "双汇火腿肠 40g×8", category: "肉制品", brand: "双汇", spec: "40g×8", costPrice: 9.60, salePrice: 14.00, stock: 2, lowStockThreshold: 5, shelfLocation: "E-1-1", expiryOffsetDays: 2 },
  { barcode: "6901234567042", name: "金锣王中王火腿肠 60g×8", category: "肉制品", brand: "金锣", spec: "60g×8", costPrice: 13.50, salePrice: 19.00, stock: 16, lowStockThreshold: 5, shelfLocation: "E-1-2", expiryOffsetDays: 60 },
  { barcode: "6901234567043", name: "雨润午餐肉罐头 340g", category: "肉制品", brand: "雨润", spec: "340g", costPrice: 11.50, salePrice: 17.00, stock: 14, lowStockThreshold: 4, shelfLocation: "E-1-3", expiryOffsetDays: 540 },

  // ===== 调料（3 件）=====
  { barcode: "6901234567051", name: "海天生抽 500ml", category: "调料", brand: "海天", spec: "500ml", costPrice: 8.00, salePrice: 12.00, stock: 20, lowStockThreshold: 5, shelfLocation: "F-1-1", expiryOffsetDays: 720 },
  { barcode: "6901234567052", name: "老干妈风味豆豉 280g", category: "调料", brand: "老干妈", spec: "280g", costPrice: 9.50, salePrice: 13.80, stock: 24, lowStockThreshold: 6, shelfLocation: "F-1-2", expiryOffsetDays: 540 },
  { barcode: "6901234567053", name: "太太乐鸡精 200g", category: "调料", brand: "太太乐", spec: "200g", costPrice: 7.00, salePrice: 10.50, stock: 18, lowStockThreshold: 5, shelfLocation: "F-1-3", expiryOffsetDays: 730 },

  // ===== 粮油（3 件）=====
  { barcode: "6901234567061", name: "金龙鱼花生油 5L", category: "粮油", brand: "金龙鱼", spec: "5L", costPrice: 75.00, salePrice: 99.00, stock: 8, lowStockThreshold: 3, shelfLocation: "G-1-1", expiryOffsetDays: 540 },
  { barcode: "6901234567062", name: "福临门大米 5kg", category: "粮油", brand: "福临门", spec: "5kg", costPrice: 32.00, salePrice: 45.00, stock: 12, lowStockThreshold: 4, shelfLocation: "G-1-2", expiryOffsetDays: 270 },
  { barcode: "6901234567063", name: "白象挂面 800g", category: "粮油", brand: "白象", spec: "800g", costPrice: 4.80, salePrice: 7.20, stock: 28, lowStockThreshold: 8, shelfLocation: "G-1-3", expiryOffsetDays: 540 },

  // ===== 日用品（3 件）=====
  { barcode: "6901234567071", name: "心相印纸巾 3层×10包", category: "日用品", brand: "心相印", spec: "3层×10包", costPrice: 18.00, salePrice: 26.00, stock: 15, lowStockThreshold: 4, shelfLocation: "H-1-1", expiryOffsetDays: null },
  { barcode: "6901234567072", name: "舒肤佳香皂 125g×3", category: "日用品", brand: "舒肤佳", spec: "125g×3", costPrice: 12.50, salePrice: 18.50, stock: 20, lowStockThreshold: 6, shelfLocation: "H-1-2", expiryOffsetDays: 900 },
  { barcode: "6901234567073", name: "高露洁牙膏 120g", category: "日用品", brand: "高露洁", spec: "120g", costPrice: 8.50, salePrice: 13.00, stock: 18, lowStockThreshold: 5, shelfLocation: "H-1-3", expiryOffsetDays: 720 },
];

async function main() {
  console.log(`🌱 开始种子：${PRODUCTS.length} 件商品`);

  const t = today();
  let created = 0;
  let updated = 0;
  let lowStockCount = 0;
  let expiringCount = 0;

  for (const p of PRODUCTS) {
    const expiryDate =
      p.expiryOffsetDays !== null ? addDays(t, p.expiryOffsetDays) : null;

    // upsert 按 barcode 幂等
    const existing = await prisma.product.findUnique({
      where: { barcode: p.barcode },
    });

    const data = {
      name: p.name,
      category: p.category,
      brand: p.brand,
      spec: p.spec,
      costPrice: p.costPrice,
      salePrice: p.salePrice,
      stock: p.stock,
      lowStockThreshold: p.lowStockThreshold,
      shelfLocation: p.shelfLocation,
      expiryDate,
    };

    if (existing) {
      await prisma.product.update({ where: { id: existing.id }, data });
      updated++;
    } else {
      await prisma.product.create({
        data: { barcode: p.barcode, ...data },
      });
      created++;
    }

    if (p.stock <= p.lowStockThreshold) lowStockCount++;
    if (expiryDate !== null) {
      const days = Math.round(
        (expiryDate.getTime() - t.getTime()) / 86_400_000,
      );
      if (days <= 7) expiringCount++;
    }
  }

  console.log(`✅ 完成：新建 ${created} 件，更新 ${updated} 件`);
  console.log(`📊 触发条件：低库存 ${lowStockCount} 件 · 7 天内到期 ${expiringCount} 件`);
}

main()
  .catch((err) => {
    console.error("❌ seed 失败", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });