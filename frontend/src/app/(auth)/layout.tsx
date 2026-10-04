"use client";

import { PublicRoute } from "@/components/auth/auth-guard";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <PublicRoute>{children}</PublicRoute>;
}
