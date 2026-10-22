"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, isValid, parseISO, subDays } from "date-fns";
import { ClipboardPlus, RefreshCw, UserRoundPlus } from "lucide-react";
import Link from "next/link";
import { apiRequest } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import type { DashboardSummary } from "@/types/dashboard";
import type { ReportListResponse, ReportRow } from "@/types/report";
import { buildWeeklyVisitSeries, countNewPatientsWithFirstVisit } from "@/lib/dashboard-analytics";

const REPORT_PAGE_SIZE = 100;
const REPORT_BATCH_SIZE = 4;

/** How often today's counts refresh. React Query pauses this while the tab is hidden. */
const LIVE_REFETCH_MS = 60_000;
/** The 7-day chart moves slowly, so it refreshes less often. */
const WEEKLY_REFETCH_MS = 120_000;

/** Ghana is on GMT all year with no daylight saving. */
const CLINIC_TIME_ZONE = "Africa/Accra";

const clinicDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: CLINIC_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}); // en-CA gives yyyy-MM-dd

const clinicTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: CLINIC_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const numberFormatter = new Intl.NumberFormat("en-GH");
const formatCount = (value: number) => numberFormatter.format(value);

/**
 * /dashboard should return `serverTime` (ISO string). We use it to measure how far the
 * device clock is from the server, so "today" is right even on a front desk PC with a bad clock.
 * Until the backend sends it, the offset stays null and the device clock is used.
 */
type DashboardResponse = DashboardSummary & { serverTime?: string };
type DashboardData = DashboardResponse & { clockOffsetMs: number | null; clinicDate: string };

async function fetchDashboard(signal?: AbortSignal): Promise<DashboardData> {
  const response = await apiRequest<DashboardResponse>("/dashboard", { signal });
  const receivedAt = Date.now();
  const serverMs = response.serverTime ? Date.parse(response.serverTime) : Number.NaN;
  return {
    ...response,
    clockOffsetMs: Number.isNaN(serverMs) ? null : serverMs - receivedAt,
    clinicDate: clinicDateFormatter.format(Number.isNaN(serverMs) ? receivedAt : serverMs),
  };
}

async function fetchAllReportRows(endpoint: string, params: URLSearchParams, signal?: AbortSignal): Promise<ReportRow[]> {
  params.set("page", "1");
  params.set("limit", String(REPORT_PAGE_SIZE));
  const firstPage = await apiRequest<ReportListResponse>(`${endpoint}?${params}`, { signal });
  const rows = [...firstPage.rows];

  for (let firstBatchPage = 2; firstBatchPage <= firstPage.pagination.totalPages; firstBatchPage += REPORT_BATCH_SIZE) {
    const pages = Array.from(
      { length: Math.min(REPORT_BATCH_SIZE, firstPage.pagination.totalPages - firstBatchPage + 1) },
      (_, index) => firstBatchPage + index
    );
    const batch = await Promise.all(pages.map(async (page) => {
      const pageParams = new URLSearchParams(params);
      pageParams.set("page", String(page));
      return apiRequest<ReportListResponse>(`${endpoint}?${pageParams}`, { signal });
    }));
    batch.forEach((pageResponse) => rows.push(...pageResponse.rows));
  }

  return rows;
}

async function fetchTodayNewPatientCount(today: string, signal?: AbortSignal): Promise<number> {
  const patientsParams = new URLSearchParams({ from: today, to: today });
  const visitsParams = new URLSearchParams({ from: today, to: today, newReturning: "new" });
  const [registeredPatients, firstVisits] = await Promise.all([
    fetchAllReportRows("/reports/patients", patientsParams, signal),
    fetchAllReportRows("/reports/opd-visits", visitsParams, signal),
  ]);
  return countNewPatientsWithFirstVisit(registeredPatients, firstVisits);
}

async function fetchWeeklyOPDReport(from: string, to: string, signal?: AbortSignal): Promise<ReportRow[]> {
  const params = new URLSearchParams({ from, to });
  return fetchAllReportRows("/reports/opd-visits", params, signal);
}

function displayDate(value: string) {
  const parsed = parseISO(value);
  return isValid(parsed) ? format(parsed, "d MMM yyyy") : value;
}

function displayLongDate(value: string) {
  const parsed = parseISO(value);
  return isValid(parsed) ? format(parsed, "EEEE, d MMMM yyyy") : value;
}

function displayOPDNo(value: string) {
  return value.replace(/^PT-/, "");
}

function describeChange(today: number, yesterday: number) {
  const difference = Math.abs(today - yesterday);
  if (difference === 0) return `Same as yesterday (${formatCount(yesterday)})`;
  return `${formatCount(difference)} ${today > yesterday ? "more" : "fewer"} than yesterday (${formatCount(yesterday)})`;
}

/**
 * Tells us when the sticky bar is pinned. The bar's `top` is the pin line minus 1px, so once pinned
 * the browser clips 1px of it. We shrink the viewport by the pin line so that clip is visible here.
 */
function useIsStuck<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === "undefined") return;

    let observer: IntersectionObserver | null = null;
    const observe = () => {
      observer?.disconnect();
      const pinLine = Math.max(0, (parseFloat(getComputedStyle(element).top) || 0) + 1);
      observer = new IntersectionObserver(
        ([entry]) => {
          setStuck(entry.isIntersecting && entry.boundingClientRect.top < entry.intersectionRect.top - 0.5);
        },
        { threshold: [0.5, 1], rootMargin: `-${pinLine}px 0px 0px 0px` }
      );
      observer.observe(element);
    };

    observe();
    window.addEventListener("resize", observe);
    return () => {
      window.removeEventListener("resize", observe);
      observer?.disconnect();
    };
  }, []);

  return { ref, stuck };
}

type LedgerRowProps = {
  label: string;
  hint?: string;
  value?: number;
  loading: boolean;
  unavailable: boolean;
  onRetry: () => unknown;
};

/** One ruled line of the register: label on the left, figure on the right. */
function LedgerRow({ label, hint, value, loading, unavailable, onRetry }: LedgerRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      <div className="flex h-9 shrink-0 items-center justify-end text-right">
        {loading ? (
          <span role="status" aria-label={`Loading ${label.toLowerCase()}`} aria-busy="true">
            <Skeleton className="h-7 w-16" />
          </span>
        ) : unavailable ? (
          <span className="flex items-center gap-2 text-sm text-destructive">
            Unavailable
            <button
              type="button"
              onClick={() => void onRetry()}
              className="inline-flex min-h-11 items-center rounded-md px-2 font-medium underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Retry
            </button>
          </span>
        ) : (
          <span className="text-2xl font-semibold tabular-nums text-foreground">{formatCount(Number(value ?? 0))}</span>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { ref: actionsRef, stuck } = useIsStuck<HTMLDivElement>();
  const {
    data,
    isLoading,
    isFetching,
    error,
    refetch,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ["dashboard-overview"],
    queryFn: ({ signal }) => fetchDashboard(signal),
    refetchInterval: LIVE_REFETCH_MS,
    refetchIntervalInBackground: false,
  });

  const clockOffsetMs = data?.clockOffsetMs ?? 0;
  const [fallbackToday] = useState(() => clinicDateFormatter.format(Date.now()));
  const today = data?.clinicDate ?? fallbackToday;
  const todayDate = useMemo(() => parseISO(today), [today]);
  const weekStart = format(subDays(todayDate, 6), "yyyy-MM-dd");
  const yesterday = format(subDays(todayDate, 1), "yyyy-MM-dd");

  const {
    data: newPatientsToday,
    isLoading: isLoadingNewPatients,
    isFetching: isFetchingNewPatients,
    error: newPatientsError,
    refetch: refetchNewPatients,
  } = useQuery({
    queryKey: ["dashboard-new-patients", today],
    queryFn: ({ signal }) => fetchTodayNewPatientCount(today, signal),
    refetchInterval: LIVE_REFETCH_MS,
    refetchIntervalInBackground: false,
  });

  const {
    data: weeklyRows,
    isLoading: isLoadingWeekly,
    isFetching: isFetchingWeekly,
    error: weeklyError,
    refetch: refetchWeekly,
  } = useQuery({
    queryKey: ["dashboard-weekly-opd", weekStart, today],
    queryFn: ({ signal }) => fetchWeeklyOPDReport(weekStart, today, signal),
    refetchInterval: WEEKLY_REFETCH_MS,
    refetchIntervalInBackground: false,
  });

  const weeklyVisits = useMemo(() => buildWeeklyVisitSeries(weeklyRows ?? []), [weeklyRows]);

  // Today's total comes from the dashboard summary. Yesterday comes from the weekly rows.
  const todayTotal = data?.todayOPDVisits ?? 0;
  const todayReturning = data?.returningPatientsToday ?? 0;
  const todayNew = Math.max(0, todayTotal - todayReturning);

  const yesterdayTotal = useMemo(() => {
    if (!weeklyRows) return null;
    return weeklyVisits.find((day) => day.date === yesterday)?.total ?? null;
  }, [weeklyRows, weeklyVisits, yesterday]);

  const summaryUnavailable = Boolean(error) && !data;
  const newPatientsUnavailable = Boolean(newPatientsError) && newPatientsToday === undefined;

  // Cached numbers stay on screen if a refresh fails; we only say they may be out of date.
  const refreshFailed =
    (Boolean(error) && Boolean(data)) ||
    (Boolean(newPatientsError) && newPatientsToday !== undefined) ||
    (Boolean(weeklyError) && Boolean(weeklyRows));

  const isRefreshing = isFetching || isFetchingNewPatients || isFetchingWeekly;
  const updatedLabel = dataUpdatedAt ? clinicTimeFormatter.format(dataUpdatedAt + clockOffsetMs) : null;

  const refreshAll = () => {
    void Promise.all([refetch(), refetchNewPatients(), refetchWeekly()]);
  };

  return (
    <section className="relative flex flex-wrap items-start gap-x-4 gap-y-6 sm:gap-y-8">
      <h2 className="flex min-w-0 basis-full items-center text-2xl font-semibold tracking-tight text-foreground sm:min-h-12 sm:text-3xl lg:flex-1 lg:basis-0">
        <span className="sr-only">Today, </span>
        {displayLongDate(today)}
      </h2>

      {/*
        The outer box keeps a fixed height, so switching to the compact look never moves the page.
        It ignores the pointer, so only the buttons catch clicks. Needs no overflow-hidden ancestor
        between here and the element that scrolls.
        Below lg it pins under the app's top bar (where the hamburger lives) so the menu stays usable.
        Set --app-header-height on a parent (or edit 3.5rem) to match that bar. From lg up the offset is 0.
      */}
      <div
        ref={actionsRef}
        className="dashboard-actions-sticky pointer-events-none sticky z-30 h-[calc(6.75rem+1px)] basis-full pt-px sm:h-[calc(3rem+1px)] lg:basis-auto lg:shrink-0"
      >
        <div
          className={cn(
            "pointer-events-auto flex",
            stuck
              ? "-mx-2 flex-row gap-2 rounded-xl border border-border bg-background/95 p-2 shadow-lg backdrop-blur sm:w-fit sm:gap-3"
              : "flex-col gap-3 sm:flex-row"
          )}
        >
          <Link
            href="/patients?register=new"
            className={cn(
              "inline-flex items-center justify-center gap-2 rounded-lg bg-primary text-center font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              stuck
                ? "min-h-10 flex-1 px-2 text-xs leading-tight sm:min-h-12 sm:flex-none sm:px-5 sm:text-sm"
                : "min-h-12 w-full px-5 text-sm sm:w-auto"
            )}
          >
            <UserRoundPlus className={cn("h-5 w-5 shrink-0", stuck && "hidden sm:block")} aria-hidden="true" />
            Register new patient
          </Link>
          <Link
            href="/opd-visits/register"
            className={cn(
              "inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-card text-center font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              stuck
                ? "min-h-10 flex-1 px-2 text-xs leading-tight sm:min-h-12 sm:flex-none sm:px-5 sm:text-sm"
                : "min-h-12 w-full px-5 text-sm sm:w-auto"
            )}
          >
            <ClipboardPlus className={cn("h-5 w-5 shrink-0 text-muted-foreground", stuck && "hidden sm:block")} aria-hidden="true" />
            Register OPD visit
          </Link>
        </div>
      </div>

      <section aria-label="Today’s figures" className="min-w-0 basis-full overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="grid lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:divide-x lg:divide-border">
          <div className="min-w-0 p-5 sm:p-6">
            <p className="text-sm font-medium text-muted-foreground">OPD visits today</p>

            <div className="mt-2 flex h-16 items-center text-5xl font-semibold tabular-nums tracking-tight text-foreground sm:text-6xl">
              {isLoading ? (
                <span role="status" aria-label="Loading today’s OPD visits" aria-busy="true">
                  <Skeleton className="h-12 w-28" />
                </span>
              ) : summaryUnavailable ? (
                <span className="flex items-center gap-2 text-base font-medium tracking-normal text-destructive">
                  Unavailable
                  <button
                    type="button"
                    onClick={() => void refetch()}
                    className="inline-flex min-h-11 items-center rounded-md px-2 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    Retry
                  </button>
                </span>
              ) : (
                formatCount(todayTotal)
              )}
            </div>

            {isLoading ? (
              <div className="mt-4 space-y-2">
                <Skeleton className="h-3 w-full rounded-full" />
                <Skeleton className="h-4 w-40 max-w-full" />
              </div>
            ) : !summaryUnavailable ? (
              <>
                <div
                  role="img"
                  aria-label={`${todayNew} new and ${todayReturning} returning visits today`}
                  className="mt-4 flex h-3 overflow-hidden rounded-full bg-muted"
                >
                  {todayNew > 0 ? <span className="h-full bg-primary" style={{ width: `${(todayNew / todayTotal) * 100}%` }} /> : null}
                  {todayReturning > 0 ? <span className="h-full bg-accent" style={{ width: `${(todayReturning / todayTotal) * 100}%` }} /> : null}
                </div>
                <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-foreground">
                  <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-primary" />{formatCount(todayNew)} new</span>
                  <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-accent" />{formatCount(todayReturning)} returning</span>
                </div>
              </>
            ) : null}

            <div className="mt-4 min-h-5 text-sm text-muted-foreground">
              {!summaryUnavailable && !isLoading ? (
                isLoadingWeekly ? (
                  <Skeleton className="h-4 w-56 max-w-full" />
                ) : yesterdayTotal !== null ? (
                  <p>{describeChange(todayTotal, yesterdayTotal)}</p>
                ) : null
              ) : null}
            </div>
          </div>

          <div className="min-w-0 divide-y divide-border border-t border-border p-5 sm:p-6 lg:border-t-0">
            <LedgerRow
              label="New patient records"
              hint="Registered today with a first visit"
              value={newPatientsToday}
              loading={isLoadingNewPatients}
              unavailable={newPatientsUnavailable}
              onRetry={refetchNewPatients}
            />
            <LedgerRow
              label="Total registered patients"
              value={data?.totalRegisteredPatients}
              loading={isLoading}
              unavailable={summaryUnavailable}
              onRetry={refetch}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-x-4 border-t border-border bg-muted/30 px-5 text-xs text-muted-foreground sm:px-6">
          {refreshFailed ? (
            <p role="status" className="py-2 text-destructive">
              Could not refresh. {updatedLabel ? `Showing figures from ${updatedLabel}.` : "Figures may be out of date."}
            </p>
          ) : (
            <p className="py-2">{updatedLabel ? `Updated ${updatedLabel}` : "Loading figures"}</p>
          )}
          <button
            type="button"
            onClick={refreshAll}
            disabled={isRefreshing}
            className="-mr-2 inline-flex min-h-11 items-center gap-2 rounded-md px-2 text-sm font-medium text-primary hover:underline hover:underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:text-muted-foreground disabled:no-underline"
          >
            <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin motion-reduce:animate-none")} aria-hidden="true" />
            {isRefreshing ? "Refreshing" : refreshFailed ? "Try again" : "Refresh"}
          </button>
        </div>
      </section>

      <section className="min-w-0 basis-full rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5" aria-labelledby="recent-visits-heading">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 id="recent-visits-heading" className="text-xl font-semibold text-foreground">Recent OPD visits</h3>
          <Link
            href="/opd-visits"
            className="-mr-2 inline-flex min-h-11 shrink-0 items-center rounded-md px-2 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            View all
          </Link>
        </div>

        {error && !data ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive" role="alert">
            <p>Unable to load recent visits.</p>
            <button
              type="button"
              className="-ml-2 mt-1 inline-flex min-h-11 items-center rounded-md px-2 font-medium underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => void refetch()}
            >
              Try again
            </button>
          </div>
        ) : null}

        {isLoading && !error ? (
          <div className="space-y-3" role="status" aria-label="Loading recent OPD visits" aria-busy="true">
            {[1, 2, 3].map((item) => (
              <div key={item} className="flex items-center justify-between gap-4 rounded-xl border border-border bg-background p-4">
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-40 max-w-full" />
                  <Skeleton className="h-4 w-48 max-w-full" />
                </div>
                <Skeleton className="h-7 w-20 rounded-full" />
              </div>
            ))}
          </div>
        ) : data && data.recentOPDVisits.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No OPD visits recorded yet.
          </div>
        ) : data && data.recentOPDVisits.length > 0 ? (
          <div className="space-y-3">
            {data.recentOPDVisits.map((visit) => (
              // flex-wrap lets the badge drop below the name when the card is narrow,
              // so the layout follows the card width instead of the screen width.
              <div key={visit.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl border border-border bg-background p-4">
                <div className="min-w-0 flex-1 basis-48">
                  <p className="break-words font-medium text-foreground">{visit.patientName}</p>
                  <p className="text-sm text-muted-foreground">OPD No. {displayOPDNo(visit.patientId)} · {displayDate(visit.date)}</p>
                </div>
                <div className="flex min-w-0 items-center gap-3">
                  <span className={cn(
                    "shrink-0 rounded-full px-2.5 py-1 text-xs font-medium",
                    visit.newReturning === "new" ? "bg-success/10 text-success" : "bg-info/10 text-info"
                  )}>
                    {visit.newReturning}
                  </span>
                  <span className="min-w-0 break-words text-xs text-muted-foreground">by {visit.registeredBy}</span>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </section>
    </section>
  );
}