// 金额、日期等展示格式化工具。统一在这里，前端代码里不要再散落 toFixed。

// Prisma Decimal 在 API 层序列化为 string，这里宽容处理 string/number/Decimal。
type PriceLike = string | number | { toString(): string } | null | undefined;

export function formatPrice(value: PriceLike): string {
  if (value === null || value === undefined) return "-";
  const num = typeof value === "number" ? value : Number(value.toString());
  if (!Number.isFinite(num)) return "-";
  return `¥${num.toFixed(2)}`;
}

export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "-";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "-";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return "-";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "-";
  return formatDate(d) + " " + d.toTimeString().slice(0, 8);
}

// 距今天 N 天内的到期日，返回剩余天数；过期返回负数；无日期返回 null
export function daysUntil(value: Date | string | null | undefined): number | null {
  if (!value) return null;
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  // 只比较日期部分，忽略时分秒
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTarget = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffMs = startOfTarget.getTime() - startOfToday.getTime();
  return Math.round(diffMs / 86_400_000);
}