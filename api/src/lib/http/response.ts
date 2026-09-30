import { NextResponse } from "next/server";

export type ApiMeta = {
  count?: number;
  total?: number;
  page?: number;
  pageSize?: number;
  pageCount?: number;
};

export type ApiResponse<T = unknown> = {
  success: boolean;
  code: string;
  message: string;
  data?: T;
  meta?: ApiMeta;
};

export function customResponse<T>(
  code: string,
  message: string,
  status: number,
  data?: T,
  meta?: ApiMeta
) {
  return NextResponse.json<ApiResponse<T>>(
    {
      success: status < 400,
      code,
      message,
      ...(data !== undefined && { data }),
      ...(meta && { meta }),
    },
    { status: status }
  );
}
