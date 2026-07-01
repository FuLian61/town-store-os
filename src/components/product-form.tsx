"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2, Save, X } from "lucide-react";
import {
  FieldSection,
  FieldGrid,
  Field,
  inputClass,
} from "./ui/field";

// 与服务端 Product 类型字段对齐；编辑模式下 prefill，初次创建全部为空。
type ProductFormValues = {
  barcode: string;
  name: string;
  category: string;
  brand: string;
  spec: string;
  costPrice: string; // 用 string 保留用户输入，提交前 parseFloat
  salePrice: string;
  stock: string;
  lowStockThreshold: string;
  shelfLocation: string;
  expiryDate: string; // YYYY-MM-DD
};

type FieldErrors = Partial<Record<keyof ProductFormValues, string[]>>;

const EMPTY: ProductFormValues = {
  barcode: "",
  name: "",
  category: "",
  brand: "",
  spec: "",
  costPrice: "",
  salePrice: "",
  stock: "0",
  lowStockThreshold: "5",
  shelfLocation: "",
  expiryDate: "",
};

function buildPayload(values: ProductFormValues) {
  // 把空字符串转 null，避免后端 schema 把 "" 当成有效值
  const trimOrNull = (s: string) => {
    const t = s.trim();
    return t.length > 0 ? t : null;
  };
  const numOrZero = (s: string) => {
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  };
  return {
    barcode: trimOrNull(values.barcode),
    name: values.name.trim(),
    category: values.category.trim(),
    brand: trimOrNull(values.brand),
    spec: trimOrNull(values.spec),
    costPrice: numOrZero(values.costPrice),
    salePrice: numOrZero(values.salePrice),
    stock: Math.max(0, Math.trunc(numOrZero(values.stock))),
    lowStockThreshold: Math.max(
      0,
      Math.trunc(numOrZero(values.lowStockThreshold)),
    ),
    shelfLocation: trimOrNull(values.shelfLocation),
    expiryDate: trimOrNull(values.expiryDate)
      ? new Date(`${values.expiryDate}T00:00:00Z`).toISOString()
      : null,
  };
}

export function ProductForm({
  mode,
  productId,
  initial,
  categoryOptions,
}: {
  mode: "create" | "edit";
  productId?: string;
  initial?: ProductFormValues;
  categoryOptions: string[];
}) {
  const router = useRouter();
  const [values, setValues] = useState<ProductFormValues>(
    initial ?? EMPTY,
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const [topError, setTopError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function update<K extends keyof ProductFormValues>(
    key: K,
    value: ProductFormValues[K],
  ) {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => {
      if (!e[key]) return e;
      const next = { ...e };
      delete next[key];
      return next;
    });
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    setTopError(null);

    // 客户端先做基础校验，避免空往返
    const clientErrors: FieldErrors = {};
    if (!values.name.trim()) clientErrors.name = ["商品名不能为空"];
    if (!values.category.trim()) clientErrors.category = ["分类不能为空"];
    const cp = Number(values.costPrice);
    const sp = Number(values.salePrice);
    if (!Number.isFinite(cp) || cp < 0)
      clientErrors.costPrice = ["进价不能小于 0"];
    if (!Number.isFinite(sp) || sp < 0)
      clientErrors.salePrice = ["售价不能小于 0"];
    if (Number.isFinite(cp) && Number.isFinite(sp) && sp < cp) {
      clientErrors.salePrice = [
        ...(clientErrors.salePrice ?? []),
        "售价应大于等于进价",
      ];
    }
    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors);
      return;
    }

    const url =
      mode === "create"
        ? "/api/products"
        : `/api/products/${productId}`;
    const method = mode === "create" ? "POST" : "PATCH";

    startTransition(async () => {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload(values)),
      });
      if (res.ok) {
        toast.success(mode === "create" ? "商品已创建" : "商品已更新");
        router.push("/products");
        router.refresh();
        return;
      }
      const body = await res.json().catch(() => null);
      const err = body?.error;
      if (err?.fields) {
        setErrors(err.fields as FieldErrors);
      }
      setTopError(err?.message ?? `请求失败 (${res.status})`);
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {topError && (
        <div className="rounded-lg border border-danger/40 bg-danger-bg/50 px-4 py-3 text-sm text-danger">
          {topError}
        </div>
      )}

      <FieldSection
        title="基本信息"
        description="商品的基础身份信息"
      >
        <FieldGrid>
          <Field label="商品名" required error={errors.name?.[0]}>
            <input
              type="text"
              value={values.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="如：可口可乐 330ml"
              className={inputClass(!!errors.name)}
            />
          </Field>
          <Field label="条码" error={errors.barcode?.[0]}>
            <input
              type="text"
              value={values.barcode}
              onChange={(e) => update("barcode", e.target.value)}
              placeholder="可选"
              className={inputClass(!!errors.barcode)}
            />
          </Field>
          <Field label="分类" required error={errors.category?.[0]}>
            <input
              type="text"
              value={values.category}
              onChange={(e) => update("category", e.target.value)}
              list="category-options"
              placeholder="如：饮料"
              className={inputClass(!!errors.category)}
            />
            <datalist id="category-options">
              {categoryOptions.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>
          <Field label="品牌" error={errors.brand?.[0]}>
            <input
              type="text"
              value={values.brand}
              onChange={(e) => update("brand", e.target.value)}
              placeholder="可选"
              className={inputClass(!!errors.brand)}
            />
          </Field>
          <Field label="规格" error={errors.spec?.[0]} className="sm:col-span-2">
            <input
              type="text"
              value={values.spec}
              onChange={(e) => update("spec", e.target.value)}
              placeholder="如：330ml / 70g"
              className={inputClass(!!errors.spec)}
            />
          </Field>
        </FieldGrid>
      </FieldSection>

      <FieldSection
        title="价格与库存"
        description="价格、当前库存和提醒阈值"
      >
        <FieldGrid>
          <Field label="进价 (¥)" required error={errors.costPrice?.[0]}>
            <input
              type="number"
              step="0.01"
              min="0"
              value={values.costPrice}
              onChange={(e) => update("costPrice", e.target.value)}
              className={inputClass(!!errors.costPrice)}
            />
          </Field>
          <Field label="售价 (¥)" required error={errors.salePrice?.[0]}>
            <input
              type="number"
              step="0.01"
              min="0"
              value={values.salePrice}
              onChange={(e) => update("salePrice", e.target.value)}
              className={inputClass(!!errors.salePrice)}
            />
          </Field>
          <Field
            label="当前库存"
            required
            hint={
              mode === "edit"
                ? "修改库存会写入调整流水"
                : "初次入库会写入入库流水"
            }
            error={errors.stock?.[0]}
          >
            <input
              type="number"
              step="1"
              min="0"
              value={values.stock}
              onChange={(e) => update("stock", e.target.value)}
              className={inputClass(!!errors.stock)}
            />
          </Field>
          <Field
            label="低库存阈值"
            required
            hint="库存 ≤ 阈值 时显示提醒"
            error={errors.lowStockThreshold?.[0]}
          >
            <input
              type="number"
              step="1"
              min="0"
              value={values.lowStockThreshold}
              onChange={(e) =>
                update("lowStockThreshold", e.target.value)
              }
              className={inputClass(!!errors.lowStockThreshold)}
            />
          </Field>
        </FieldGrid>
      </FieldSection>

      <FieldSection title="位置与效期" description="货架位置和到期日期（可选）">
        <FieldGrid>
          <Field label="货架位置" error={errors.shelfLocation?.[0]}>
            <input
              type="text"
              value={values.shelfLocation}
              onChange={(e) => update("shelfLocation", e.target.value)}
              placeholder="如：A-1-3"
              className={inputClass(!!errors.shelfLocation)}
            />
          </Field>
          <Field label="到期日期" error={errors.expiryDate?.[0]}>
            <input
              type="date"
              value={values.expiryDate}
              onChange={(e) => update("expiryDate", e.target.value)}
              className={inputClass(!!errors.expiryDate)}
            />
          </Field>
        </FieldGrid>
      </FieldSection>

      <div className="flex items-center justify-end gap-3 rounded-lg border border-line bg-surface px-5 py-4">
        <Link
          href="/products"
          className="inline-flex items-center gap-1.5 rounded-md border border-line-strong bg-surface px-4 py-2 text-sm font-medium transition-colors hover:bg-surface-2"
        >
          <X className="h-4 w-4" />
          取消
        </Link>
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-sm font-medium text-surface transition-colors hover:bg-accent-hover disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-accent/40"
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {mode === "create" ? "创建商品" : "保存修改"}
        </button>
      </div>
    </form>
  );
}

export type { ProductFormValues };
