"use client";

import { ProtectedRoute } from "@/components/auth/auth-guard";
import { AppSidebar } from "@/components/layout/app-sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <div className="print:hidden">
          <AppSidebar />
        </div>

        <div className="lg:pl-72 print:pl-0">
          <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8 print:max-w-none print:px-0 print:py-0">{children}</main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
