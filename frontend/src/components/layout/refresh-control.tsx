"use client";

import { useRef, useState } from "react";
import { isCancelledError, useQueryClient } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

export function RefreshControl({ className }: { className?: string }) {
  const queryClient = useQueryClient();
  const pathname = usePathname();
  const requestIdRef = useRef(0);
  const [refreshing, setRefreshing] = useState<{ pathname: string; requestId: number } | null>(null);
  const [status, setStatus] = useState<{ pathname: string; message: string; isError: boolean } | null>(null);
  const isRefreshing = refreshing?.pathname === pathname;
  const visibleStatus = status?.pathname === pathname ? status : null;

  const refresh = async () => {
    if (isRefreshing) return;
    const requestId = ++requestIdRef.current;
    setRefreshing({ pathname, requestId });
    setStatus(null);
    try {
      const activeQueries = queryClient
        .getQueryCache()
        .findAll({ type: "active" })
        .filter((query) => !query.isDisabled() && !query.isStatic());

      await queryClient.refetchQueries({ type: "active" });

      const refreshFailed = activeQueries.some(
        (query) => query.state.status === "error" && !isCancelledError(query.state.error)
      );
      if (requestId === requestIdRef.current) {
        setStatus({
          pathname,
          message: refreshFailed
            ? "Some data could not be refreshed. Please try again."
            : "Page data refreshed.",
          isError: refreshFailed,
        });
      }
    } catch {
      if (requestId === requestIdRef.current) {
        setStatus({ pathname, message: "Some data could not be refreshed. Please try again.", isError: true });
      }
    } finally {
      if (requestId === requestIdRef.current) setRefreshing(null);
    }
  };

  return (
    <div className={cn("mx-auto flex min-h-12 items-center justify-end gap-3", className)}>
      <p role="status" aria-live="polite" className={`text-xs ${visibleStatus?.isError ? "text-destructive" : "text-muted-foreground"}`}>
        {visibleStatus?.message ?? ""}
      </p>
      <button
        type="button"
        className="inline-flex min-h-11 items-center gap-2 rounded-md px-2 text-sm font-medium text-primary hover:underline hover:underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:text-muted-foreground disabled:no-underline"
        aria-label={isRefreshing ? "Refreshing page data" : "Refresh page data"}
        disabled={isRefreshing}
        onClick={() => void refresh()}
      >
        <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin motion-reduce:animate-none" : ""}`} aria-hidden="true" />
        {isRefreshing ? "Refreshing" : "Refresh"}
      </button>
    </div>
  );
}
