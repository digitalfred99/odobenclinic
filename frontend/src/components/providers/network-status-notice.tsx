"use client";

import { useEffect, useState } from "react";
import { CloseButton } from "@/components/ui/close-button";
import {
  NETWORK_FAILURE_EVENT,
  NETWORK_FAILURE_MESSAGE,
} from "@/lib/api";

type NetworkNotice = "offline" | "request-failed" | "restored" | null;

export function NetworkStatusNotice() {
  const [notice, setNotice] = useState<NetworkNotice>(null);

  useEffect(() => {
    const showOffline = () => setNotice("offline");
    const showOnline = () => {
      setNotice((current) => current === "offline" ? "restored" : current);
    };
    const showRequestFailure = () => {
      setNotice(navigator.onLine ? "request-failed" : "offline");
    };

    window.addEventListener("offline", showOffline);
    window.addEventListener("online", showOnline);
    window.addEventListener(NETWORK_FAILURE_EVENT, showRequestFailure);
    queueMicrotask(() => {
      if (!navigator.onLine) setNotice("offline");
    });

    return () => {
      window.removeEventListener("offline", showOffline);
      window.removeEventListener("online", showOnline);
      window.removeEventListener(NETWORK_FAILURE_EVENT, showRequestFailure);
    };
  }, []);

  useEffect(() => {
    if (notice !== "restored") return;
    const timeoutId = window.setTimeout(() => setNotice(null), 6000);
    return () => window.clearTimeout(timeoutId);
  }, [notice]);

  if (!notice) return null;

  const isRestored = notice === "restored";
  const message = notice === "offline"
    ? "You’re offline. Actions can’t reach the server until you reconnect and retry."
    : isRestored
      ? "Connection restored. Retry the action that didn’t complete."
      : NETWORK_FAILURE_MESSAGE;

  return (
    <div
      role={isRestored ? "status" : "alert"}
      aria-live={isRestored ? "polite" : "assertive"}
      className={`fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-[200] mx-auto flex max-w-xl items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg ${
        isRestored
          ? "border-success/30 bg-card text-foreground"
          : "border-warning/40 bg-card text-foreground"
      }`}
    >
      <span
        aria-hidden="true"
        className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${isRestored ? "bg-success" : "bg-warning"}`}
      />
      <span className="min-w-0 flex-1">{message}</span>
      <CloseButton
        aria-label="Dismiss connection notice"
        onClick={() => setNotice(null)}
        className="-mr-2 -mt-2"
      />
    </div>
  );
}
