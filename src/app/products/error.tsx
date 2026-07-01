"use client";

import { RouteError } from "@/components/ui/route-error";

export default function Error(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteError title="商品列表加载失败" homeHref="/dashboard" {...props} />;
}
