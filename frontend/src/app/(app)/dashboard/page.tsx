"use client";

import { useQuery } from "@tanstack/react-query";
import { Activity, ArrowRight, FileText, Users, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import type { DashboardSummary } from "@/types/dashboard";

type DashboardStatKey = Exclude<keyof DashboardSummary, "recentOPDVisits">;

const statCards: Array<{
  key: DashboardStatKey;
  label: string;
  icon: typeof Activity;
  accent: string;
}> = [
  { key: "todayOPDVisits", label: "Today's OPD visits", icon: Activity, accent: "bg-primary/10 text-primary" },
  { key: "newPatientsToday", label: "New patients today", icon: UserPlus, accent: "bg-success/10 text-success" },
  { key: "returningPatientsToday", label: "Returning patients", icon: Users, accent: "bg-info/10 text-info" },
  { key: "totalRegisteredPatients", label: "Total patients", icon: FileText, accent: "bg-warning/10 text-warning" },
];

export default function DashboardPage() {
  const router = useRouter();

  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard-overview"],
    queryFn: async () => apiRequest<DashboardSummary>("/dashboard"),
  });

  const stats = data ?? {
    todayOPDVisits: 0,
    newPatientsToday: 0,
    returningPatientsToday: 0,
    totalRegisteredPatients: 0,
    recentOPDVisits: [],
  };

  return (
    <section className="space-y-8">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">Overview</p>
        <h2 className="mt-3 text-3xl font-semibold text-foreground">Patient & OPD dashboard</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Quick visibility across today&apos;s clinic activity and recent visits, with fast access to patient and attendance workflows.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {statCards.map(({ key, label, icon: Icon, accent }) => (
          <div key={key} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="mt-3 text-3xl font-semibold text-foreground">
                  {isLoading ? (
                    <span role="status" aria-label={`Loading ${label.toLowerCase()}`} aria-busy="true">
                      <Skeleton className="h-9 w-20" />
                    </span>
                  ) : Number(stats[key] ?? 0)}
                </p>
              </div>
              <div className={cn("rounded-xl p-3", accent)}>
                <Icon className="h-5 w-5" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-xl font-semibold text-foreground">Recent OPD visits</h3>
            <button type="button" className="text-sm font-medium text-primary" onClick={() => router.push("/opd-visits")}>View all</button>
          </div>

          {error ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">Unable to load dashboard data.</div>
          ) : null}

          {isLoading ? (
            <div className="space-y-3" role="status" aria-label="Loading recent OPD visits" aria-busy="true">
              {[1, 2, 3].map((item) => (
                <div key={item} className="flex items-center justify-between gap-4 rounded-xl border border-border bg-background p-4">
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-4 w-48 max-w-full" />
                  </div>
                  <Skeleton className="h-7 w-20 rounded-full" />
                </div>
              ))}
            </div>
          ) : stats.recentOPDVisits.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No OPD visits recorded yet.
            </div>
          ) : (
            <div className="space-y-3">
              {stats.recentOPDVisits.map((visit) => (
                <div key={visit.id} className="flex flex-col gap-2 rounded-xl border border-border bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium text-foreground">{visit.patientName}</p>
                    <p className="text-sm text-muted-foreground">{visit.patientId} • {visit.date}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={cn(
                      "rounded-full px-2.5 py-1 text-xs font-medium",
                      visit.newReturning === "new" ? "bg-success/10 text-success" : "bg-info/10 text-info"
                    )}>
                      {visit.newReturning}
                    </span>
                    <span className="text-xs text-muted-foreground">by {visit.registeredBy}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h3 className="text-xl font-semibold text-foreground">Quick actions</h3>
          <div className="mt-4 space-y-3">
            <button type="button" onClick={() => router.push("/patients")} className="flex w-full items-center justify-between rounded-xl border border-border bg-background px-4 py-3 text-left transition hover:border-primary/60 hover:bg-secondary/30">
              <span className="font-medium text-foreground">Register patient</span>
              <ArrowRight className="h-4 w-4 text-primary" />
            </button>
            <button type="button" onClick={() => router.push("/opd-visits")} className="flex w-full items-center justify-between rounded-xl border border-border bg-background px-4 py-3 text-left transition hover:border-primary/60 hover:bg-secondary/30">
              <span className="font-medium text-foreground">Register OPD visit</span>
              <ArrowRight className="h-4 w-4 text-primary" />
            </button>
            <button type="button" onClick={() => router.push("/patients")} className="flex w-full items-center justify-between rounded-xl border border-border bg-background px-4 py-3 text-left transition hover:border-primary/60 hover:bg-secondary/30">
              <span className="font-medium text-foreground">Search patient</span>
              <ArrowRight className="h-4 w-4 text-primary" />
            </button>
            <button type="button" onClick={() => router.push("/reports")} className="flex w-full items-center justify-between rounded-xl border border-border bg-background px-4 py-3 text-left transition hover:border-primary/60 hover:bg-secondary/30">
              <span className="font-medium text-foreground">View reports</span>
              <ArrowRight className="h-4 w-4 text-primary" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
