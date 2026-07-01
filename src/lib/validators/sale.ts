import { z } from "zod";

export const saleItemInputSchema = z.object({
  productId: z.string().min(1, "商品 ID 不能为空"),
  quantity: z
    .number()
    .int("数量必须是整数")
    .positive("数量必须大于 0"),
});

export const createSaleSchema = z.object({
  items: z
    .array(saleItemInputSchema)
    .min(1, "销售明细不能为空"),
  note: z
    .string()
    .trim()
    .max(200, "备注最多 200 字")
    .optional()
    .transform((s) => (s && s.length > 0 ? s : null)),
});

export type CreateSaleInput = z.infer<typeof createSaleSchema>;
export type SaleItemInput = z.infer<typeof saleItemInputSchema>;

export const listSalesQuerySchema = z.object({
  from: z
    .string()
    .datetime({ offset: true })
    .optional()
    .transform((s) => (s ? new Date(s) : undefined)),
  to: z
    .string()
    .datetime({ offset: true })
    .optional()
    .transform((s) => (s ? new Date(s) : undefined)),
  limit: z
    .string()
    .optional()
    .transform((s) => (s ? Math.min(200, Math.max(1, parseInt(s, 10) || 50)) : 50)),
});

export type ListSalesQuery = z.infer<typeof listSalesQuerySchema>;