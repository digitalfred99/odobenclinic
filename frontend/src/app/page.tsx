"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/components/auth/auth-provider";

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

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(27,94,92,0.16),_transparent_40%),linear-gradient(to_bottom,_#f9fbf9,_#eef6f3)] px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-border bg-background p-6 text-center shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Odoben Health Center</p>
        <p className="mt-4 text-sm text-muted-foreground">Redirecting you to the right place...</p>
      </div>
    </main>
  );
}
