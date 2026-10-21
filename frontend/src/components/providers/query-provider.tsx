"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { ApiError } from "@/lib/api";

export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (failureCount >= 2) return false;
  if (error instanceof ApiError) {
    return error.status === 408 || error.status === 429 || error.status >= 500;
  }
  return error instanceof TypeError;
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        retry: shouldRetryQuery,
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 3000),
        staleTime: 60_000,
      },
    },
  }));

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
