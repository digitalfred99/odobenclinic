"use client";

import { useEffect, useRef, useState } from "react";
import type { FocusEvent } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type FeedbackMessageProps = {
  message: string;
  kind: "success" | "error";
  onDismiss: () => void;
};

export function FeedbackMessage({ message, kind, onDismiss }: FeedbackMessageProps) {
  const messageRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);
  const isSuccess = kind === "success";

  useEffect(() => {
    messageRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [message]);

  useEffect(() => {
    if (isPaused) {
      return;
    }

    const timeoutId = window.setTimeout(onDismiss, isSuccess ? 7000 : 10000);
    return () => window.clearTimeout(timeoutId);
  }, [isPaused, isSuccess, message, onDismiss]);

  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setIsPaused(false);
    }
  };

  return (
    <div
      ref={messageRef}
      role={isSuccess ? "status" : "alert"}
      aria-atomic="true"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocusCapture={() => setIsPaused(true)}
      onBlurCapture={handleBlur}
      className={cn(
        "flex scroll-mt-4 items-start justify-between gap-3 rounded-md border px-3 py-2 text-sm",
        isSuccess
          ? "border-success/30 bg-success/10 text-success"
          : "border-destructive/30 bg-destructive/5 text-destructive"
      )}
    >
      <span className="min-w-0 flex-1">{message}</span>
      <button
        type="button"
        aria-label="Dismiss message"
        onClick={onDismiss}
        className="-mr-1 -mt-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
