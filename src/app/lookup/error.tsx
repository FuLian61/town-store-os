"use client";

import { RouteError } from "@/components/ui/route-error";

export default function Error(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteError title="查价页面出错了" homeHref="/dashboard" {...props} />;
}
