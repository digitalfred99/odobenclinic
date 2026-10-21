"use client";

import { usePathname } from "next/navigation";
import { ProtectedRoute } from "@/components/auth/auth-guard";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { RefreshControl } from "@/components/layout/refresh-control";

const NARROW_REFRESH_ROUTES = new Set(["/opd-visits", "/opd-visits/list", "/opd-visits/register"]);

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <div className="print:hidden">
          <AppSidebar />
        </div>

        <div className="pt-16 lg:pl-72 lg:pt-0 print:pl-0 print:pt-0">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 print:hidden">
            {pathname !== "/dashboard" ? (
              <RefreshControl className={NARROW_REFRESH_ROUTES.has(pathname) ? "max-w-6xl" : undefined} />
            ) : null}
          </div>
          <main className="mx-auto max-w-7xl px-4 pb-6 sm:px-6 lg:px-8 lg:pb-8 print:max-w-none print:px-0 print:py-0">{children}</main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
