import { NextResponse } from "next/server";
import { ZodError } from "zod";

// 统一错误响应结构
export type ApiError = {
  error: {
    message: string;
    code: string;
    fields?: Record<string, string[]>;
  };
};

export function apiError(
  message: string,
  status: number,
  code: string,
  fields?: Record<string, string[]>,
): NextResponse<ApiError> {
  return NextResponse.json(
    { error: { message, code, ...(fields ? { fields } : {}) } },
    { status },
  );
}

export function handleZodError(err: ZodError): NextResponse<ApiError> {
  const fields: Record<string, string[]> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".") || "_";
    if (!fields[key]) fields[key] = [];
    fields[key].push(issue.message);
  }
  return apiError("请求参数校验失败", 422, "VALIDATION_ERROR", fields);
}

// Prisma 已知错误码 → HTTP 状态码
export function prismaErrorStatus(code: string): number | null {
  switch (code) {
    case "P2002": // unique constraint
      return 409;
    case "P2025": // record not found
      return 404;
    case "P2003": // foreign key constraint
      return 409;
    default:
      return null;
  }
}