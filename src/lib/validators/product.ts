import { z } from "zod";

// 字符串字段统一 trim；空字符串视作 null（避免脏数据）。
const trimmedString = z
  .string()
  .transform((s) => s.trim())
  .pipe(z.string());

const optionalText = trimmedString
  .optional()
  .transform((s) => (s && s.length > 0 ? s : null));

const optionalDate = z
  .string()
  .datetime({ offset: true })
  .optional()
  .transform((s) => (s ? new Date(s) : null));

const priceField = z
  .number()
  .nonnegative("价格不能小于 0")
  .finite("价格必须是有限数字")
  .multipleOf(0.01, "价格最多两位小数");

const stockField = z
  .number()
  .int("库存必须是整数")
  .nonnegative("库存不能小于 0");

const thresholdField = z
  .number()
  .int("阈值必须是整数")
  .nonnegative("阈值不能小于 0");

// 抽出基础对象，create/update 各自加约束和 refine
const productBaseSchema = z.object({
  barcode: optionalText,
  name: trimmedString.pipe(z.string().min(1, "商品名不能为空")),
  category: trimmedString.pipe(z.string().min(1, "分类不能为空")),
  brand: optionalText,
  spec: optionalText,
  costPrice: priceField,
  salePrice: priceField,
  stock: stockField.default(0),
  lowStockThreshold: thresholdField.default(5),
  shelfLocation: optionalText,
  expiryDate: optionalDate,
});

export const createProductSchema = productBaseSchema.refine(
  (d) => d.salePrice >= d.costPrice,
  { message: "售价应大于等于进价", path: ["salePrice"] },
);

// update 走 partial，对存在的字段做同样的"售价 >= 进价"校验
export const updateProductSchema = productBaseSchema
  .partial()
  .refine(
    (d) =>
      d.salePrice === undefined ||
      d.costPrice === undefined ||
      d.salePrice >= d.costPrice,
    { message: "售价应大于等于进价", path: ["salePrice"] },
  );

export type CreateProductInput = z.infer<typeof productBaseSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

// 列表查询参数：name/barcode/brand 模糊匹配，可选 category 精确匹配
export const listProductsQuerySchema = z.object({
  q: z.string().trim().optional(),
  category: z.string().trim().optional(),
});

export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;