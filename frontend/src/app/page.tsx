"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { HealthLoadingScreen } from "@/components/ui/health-loading-screen";

export default function Home() {
  const router = useRouter();
  const { status } = useAuth();

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/dashboard");
      return;
    }

    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [router, status]);

  return <HealthLoadingScreen label={status === "loading" ? "Loading session" : "Redirecting"} />;
}
