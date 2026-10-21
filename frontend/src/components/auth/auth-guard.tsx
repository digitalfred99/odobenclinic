"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { HealthLoadingScreen } from "@/components/ui/health-loading-screen";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { status } = useAuth();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [router, status]);

  if (status === "loading") {
    return <HealthLoadingScreen label="Loading session" />;
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
    return <HealthLoadingScreen label="Checking session" />;
  }

  if (status === "authenticated") {
    return null;
  }

  return <>{children}</>;
}
