"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { Skeleton } from "@/components/ui/skeleton";

function SessionLoading({ label }: { label: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4" role="status" aria-label={label} aria-busy="true">
      <div className="w-full max-w-sm space-y-5 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <Skeleton className="mx-auto h-12 w-12 rounded-xl" />
        <div className="space-y-3">
          <Skeleton className="mx-auto h-4 w-3/4" />
          <Skeleton className="mx-auto h-3 w-1/2" />
        </div>
      </div>
    </div>
  );
}

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { status } = useAuth();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [router, status]);

  if (status === "loading") {
    return <SessionLoading label="Loading session" />;
  }

  if (status === "unauthenticated") {
    return null;
  }

  return <>{children}</>;
}

export function PublicRoute({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { status } = useAuth();

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/dashboard");
    }
  }, [router, status]);

  if (status === "loading") {
    return <SessionLoading label="Checking session" />;
  }

  if (status === "authenticated") {
    return null;
  }

  return <>{children}</>;
}
