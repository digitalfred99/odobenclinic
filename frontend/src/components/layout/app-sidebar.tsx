"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  FileText,
  HeartPulse,
  LayoutGrid,
  LogOut,
  Menu,
  ShieldCheck,
  UserCircle2,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { displayRoleLabel, type UserRole } from "@/types/auth";

type NavItem = {
  label: string;
  href: string;
  icon: typeof LayoutGrid;
};

function SidebarContent({
  pathname,
  onNavigate,
  isAdmin,
  user,
  onLogout,
}: {
  pathname: string;
  onNavigate: (href: string) => void;
  isAdmin: boolean;
  user?: { firstName?: string; lastName?: string; role?: UserRole } | null;
  onLogout: () => void;
}) {
  const items: NavItem[] = [
    { label: "Home", href: "/dashboard", icon: LayoutGrid },
    { label: "Patients", href: "/patients", icon: Users },
    { label: "OPD", href: "/opd-visits", icon: HeartPulse },
    { label: "Reports", href: "/reports", icon: BarChart3 },
    ...(isAdmin ? [{ label: "Users", href: "/users", icon: ShieldCheck }] : []),
    ...(isAdmin ? [{ label: "Audit", href: "/audit-logs", icon: FileText }] : []),
    { label: "Profile", href: "/profile", icon: UserCircle2 },
  ];

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-border px-4 py-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <HeartPulse className="h-5 w-5" />
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-primary">ODOBEN</p>
          <p className="text-sm font-semibold tracking-[0.2em] text-foreground">HEALTH</p>
          <p className="text-sm font-semibold tracking-[0.2em] text-foreground">CENTER</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {items.map(({ label, href, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(`${href}/`);

          return (
            <button
              key={href}
              type="button"
              onClick={() => onNavigate(href)}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{label}</span>
            </button>
          );
        })}
      </nav>

      <div className="border-t border-border p-3">
        <div className="mb-3 flex items-center gap-3 rounded-xl bg-muted/60 px-3 py-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
            <UserCircle2 className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">
              {user?.firstName ?? "User"} {user?.lastName ?? ""}
            </p>
            <p className="truncate text-xs text-muted-foreground">{displayRoleLabel(user?.role)}</p>
          </div>
        </div>

        <Button type="button" variant="outline" className="w-full justify-center gap-2" onClick={onLogout}>
          <LogOut className="h-4 w-4" />
          Logout
        </Button>
      </div>
    </div>
  );
}

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [mobileOpenForPath, setMobileOpenForPath] = useState<string | null>(null);
  const [mobileHeaderVisible, setMobileHeaderVisible] = useState(true);
  const mobileOpen = mobileOpenForPath === pathname;
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  useEffect(() => {
    let previousScrollY = document.scrollingElement?.scrollTop ?? window.scrollY;
    let accumulatedScrollDelta = 0;

    const handleScroll = () => {
      const currentScrollY = document.scrollingElement?.scrollTop ?? window.scrollY;
      accumulatedScrollDelta += currentScrollY - previousScrollY;
      previousScrollY = currentScrollY;

      if (currentScrollY <= 24) {
        accumulatedScrollDelta = 0;
        setMobileHeaderVisible(true);
      } else if (Math.abs(accumulatedScrollDelta) >= 14) {
        setMobileHeaderVisible(accumulatedScrollDelta < 0);
        accumulatedScrollDelta = 0;
      }
    };

    document.addEventListener("scroll", handleScroll, { passive: true, capture: true });
    return () => document.removeEventListener("scroll", handleScroll, true);
  }, []);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileOpenForPath(null);
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, []);

  const handleNavigate = (href: string) => {
    router.push(href);
    setMobileOpenForPath(null);
  };

  const handleLogout = () => {
    void logout();
  };

  const isMobileHeaderVisible = mobileHeaderVisible || mobileOpen;

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-30 border-b border-border bg-card px-4 py-3 shadow-sm transition-opacity duration-200 ease-linear motion-reduce:transition-none lg:hidden",
          isMobileHeaderVisible ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        aria-hidden={!isMobileHeaderVisible}
      >
        <button
          type="button"
          aria-label="Open navigation menu"
          aria-expanded={mobileOpen}
          aria-controls="mobile-navigation-drawer"
          tabIndex={isMobileHeaderVisible ? 0 : -1}
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => setMobileOpenForPath(pathname)}
        >
          <Menu className="h-5 w-5" />
        </button>
      </header>

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 flex-col border-r border-border bg-card/95 shadow-sm backdrop-blur-sm lg:flex">
        <SidebarContent
          pathname={pathname}
          onNavigate={handleNavigate}
          isAdmin={isAdmin}
          user={user}
          onLogout={handleLogout}
        />
      </aside>

      {mobileOpen ? (
        <button
          type="button"
          aria-label="Close navigation menu"
          className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-[2px] lg:hidden"
          onClick={() => setMobileOpenForPath(null)}
        />
      ) : null}

      <aside
        id="mobile-navigation-drawer"
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[85vw] max-w-[18rem] flex-col border-r border-border bg-card shadow-xl transition-transform duration-200 lg:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
        aria-label="Mobile navigation menu"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-4">
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-primary">Menu</div>
          <button
            type="button"
            aria-label="Close navigation menu"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg hover:bg-muted"
            onClick={() => setMobileOpenForPath(null)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <SidebarContent
          pathname={pathname}
          onNavigate={handleNavigate}
          isAdmin={isAdmin}
          user={user}
          onLogout={handleLogout}
        />
      </aside>
    </>
  );
}
