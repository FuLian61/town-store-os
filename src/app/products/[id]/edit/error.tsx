"use client";

import { RouteError } from "@/components/ui/route-error";

export default function Error(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteError
      title="编辑商品时出错了"
      homeHref="/products"
      {...props}
    />
  );
}
