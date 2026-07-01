"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Props = {
  productId: string;
  productName: string;
};

/**
 * 产品下架按钮(删除)。点击展开确认区,再次点击调用 DELETE /api/products/[id]。
 * 后端在商品有销售历史时会拒绝(返回 409 + PRODUCT_HAS_HISTORY),UI 用 toast 兜底。
 */
export function DeleteProductButton({ productId, productName }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleDelete() {
    startTransition(async () => {
      const res = await fetch(`/api/products/${productId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("商品已删除");
        router.push("/products");
        router.refresh();
        return;
      }
      const body = await res.json().catch(() => null);
      toast.error(body?.error?.message ?? `删除失败 (${res.status})`);
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md border border-danger/40 bg-surface px-3 py-2 text-sm font-medium text-danger transition-colors hover:bg-danger hover:text-surface"
      >
        <Trash2 className="h-4 w-4" />
        删除商品
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-danger/40 bg-danger-bg/40 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 flex-none text-danger" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ink">
            确定删除「{productName}」?
          </p>
          <p className="mt-1 text-xs text-ink-2">
            删除后无法恢复。如果这个商品已经有销售记录,系统会拒绝删除,请先下架相关销售单。
          </p>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={pending}
          className="rounded-md border border-line-strong bg-surface px-3 py-1.5 text-sm font-medium transition-colors hover:bg-surface-2 disabled:opacity-50"
        >
          取消
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-md bg-danger px-3 py-1.5 text-sm font-medium text-surface transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          确认删除
        </button>
      </div>
    </div>
  );
}
