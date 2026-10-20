"use client";

import { useQuery } from "@tanstack/react-query";
import { format, isValid, parseISO } from "date-fns";
import { CalendarDays, Filter, Loader2, MapPin, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/api";
import { buildOPDVisitQuery, getVisitDateRange, type VisitDatePreset, type VisitDateRange } from "@/lib/opd-visits";
import type { OPDVisitListResponse } from "@/types/opd";

const PAGE_SIZE = 20;
const EMPTY_RANGE: VisitDateRange = { dateFrom: "", dateTo: "" };

function formatVisitDate(date: string) {
  const parsedDate = parseISO(date);
  return isValid(parsedDate) ? format(parsedDate, "d MMM yyyy") : date;
}

function formatPatientId(patientId?: string) {
  return patientId?.replace(/^PT-/, "") || "ID unavailable";
}

function rangeForPreset(preset: VisitDatePreset): VisitDateRange {
  if (preset === "all" || preset === "custom") return EMPTY_RANGE;
  return getVisitDateRange(preset);
}

export default function OPDVisitList() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftPreset, setDraftPreset] = useState<VisitDatePreset>("all");
  const [appliedPreset, setAppliedPreset] = useState<VisitDatePreset>("all");
  const [draftRange, setDraftRange] = useState<VisitDateRange>(EMPTY_RANGE);
  const [appliedRange, setAppliedRange] = useState<VisitDateRange>(EMPTY_RANGE);
  const [page, setPage] = useState(1);
  const [filterError, setFilterError] = useState<string | null>(null);
  const [lastData, setLastData] = useState<OPDVisitListResponse | undefined>(undefined);

  const searchRef = useRef<HTMLInputElement>(null);
  const listTopRef = useRef<HTMLDivElement>(null);

  const debouncedSearchTerm = useDebouncedValue(searchTerm);
  const trimmedSearch = searchTerm.trim();
  const isSettling = trimmedSearch !== debouncedSearchTerm.trim();
  const query = buildOPDVisitQuery(debouncedSearchTerm, appliedRange, page, PAGE_SIZE);
  const hasDateFilter = Boolean(appliedRange.dateFrom || appliedRange.dateTo);
  const hasAnyFilter = hasDateFilter || Boolean(trimmedSearch);

  const { data, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: ["opd-visits", query],
    queryFn: ({ signal }) => apiRequest<OPDVisitListResponse>(`/opd-visits?${query}`, { signal }),
  });

  /* Keep the previous results on screen while a new search loads, so the list does not flash. */
  useEffect(() => {
    if (data) setLastData(data);
  }, [data]);

  const shown = data ?? lastData;
  const isRefreshing = !data && Boolean(lastData) && (isFetching || isSettling);
  const visits = shown?.opdVisits ?? [];
  const pagination = shown?.pagination;
  const totalPages = pagination?.totalPages ?? 1;
  const total = pagination?.total ?? visits.length;

  const showSkeleton = !shown && (isLoading || isSettling) && !isError;
  const showEmpty = Boolean(shown) && visits.length === 0 && !isError && !isFetching && !isSettling;

  /* Press "/" anywhere to jump to the search box. */
  useEffect(() => {
    const onKeyDown = (event: WindowEventMap["keydown"]) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target?.isContentEditable) return;
      event.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const openFilters = () => {
    if (!filtersOpen) {
      setDraftPreset(appliedPreset);
      setDraftRange(appliedRange);
      setFilterError(null);
    }
    setFiltersOpen((open) => !open);
  };

  const selectPreset = (preset: VisitDatePreset) => {
    setDraftPreset(preset);
    setFilterError(null);
    if (preset !== "custom") {
      setDraftRange(rangeForPreset(preset));
    }
  };

  const applyFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (draftPreset === "custom" && draftRange.dateFrom && draftRange.dateTo && draftRange.dateFrom > draftRange.dateTo) {
      setFilterError("The start date must be on or before the end date.");
      return;
    }

    const hasRange = Boolean(draftRange.dateFrom || draftRange.dateTo);
    setAppliedPreset(hasRange ? draftPreset : "all");
    setAppliedRange(draftRange);
    setPage(1);
    setFilterError(null);
    setFiltersOpen(false);
  };

  const resetDateFilter = () => {
    setDraftPreset("all");
    setDraftRange(EMPTY_RANGE);
    setAppliedPreset("all");
    setAppliedRange(EMPTY_RANGE);
    setFilterError(null);
    setPage(1);
  };

  const clearAll = () => {
    setSearchTerm("");
    resetDateFilter();
    setFiltersOpen(false);
    searchRef.current?.focus();
  };

  const goToPage = (nextPage: number) => {
    setPage(nextPage);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    listTopRef.current?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  };

  const rangeStart = total > 0 ? (page - 1) * PAGE_SIZE + 1 : 0;
  const rangeEnd = Math.min(page * PAGE_SIZE, total);

  return (
    <section className="mx-auto w-full max-w-6xl space-y-5 sm:space-y-6">
      <header className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="min-w-0">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Attendance history</h2>
          <p className="mt-1.5 hidden max-w-2xl text-sm leading-6 text-muted-foreground sm:block">
            Find a visit by patient name, permanent OPD No., or attendance date.
          </p>
        </div>
        <Button
          type="button"
          className="min-h-11 w-full sm:w-auto"
          onClick={() => router.push("/opd-visits/register")}
        >
          Register visit
        </Button>
      </header>

      <div className="space-y-4 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6">
        {/* Search */}
        <div role="search">
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="visit-search" className="text-sm font-semibold text-foreground">
              Search visits
            </label>
            <button
              type="button"
              aria-expanded={filtersOpen}
              aria-controls={filtersOpen ? "opd-visit-filters" : undefined}
              onClick={openFilters}
              className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                hasDateFilter
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-background text-foreground hover:bg-secondary/50"
              }`}
            >
              <Filter className="h-3.5 w-3.5" aria-hidden="true" />
              Filter{hasDateFilter ? " (1)" : ""}
            </button>
          </div>
          <div className="mt-2 flex h-14 items-center rounded-xl border-2 border-primary/40 bg-background pl-4 pr-2 shadow-sm transition focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/15">
            <Search className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
            <input
              id="visit-search"
              ref={searchRef}
              type="text"
              value={searchTerm}
              onChange={(event) => {
                setSearchTerm(event.target.value);
                setPage(1);
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape" && searchTerm) {
                  event.preventDefault();
                  setSearchTerm("");
                  setPage(1);
                }
              }}
              inputMode="search"
              enterKeyHint="search"
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              placeholder="Type a patient name, OPD No. or visit date"
              className="h-full min-w-0 flex-1 bg-transparent px-3 text-base text-foreground outline-none placeholder:text-muted-foreground"
            />
            {trimmedSearch && (isFetching || isSettling) ? (
              <Loader2 className="mr-2 h-4 w-4 shrink-0 animate-spin text-muted-foreground" aria-hidden="true" />
            ) : null}
            {searchTerm ? (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => {
                  setSearchTerm("");
                  setPage(1);
                  searchRef.current?.focus();
                }}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            ) : (
              <kbd
                className="mr-1 hidden h-7 min-w-7 items-center justify-center rounded-md border border-border bg-secondary px-2 text-xs font-medium text-muted-foreground lg:inline-flex"
                aria-hidden="true"
                title="Press / to search"
              >
                /
              </kbd>
            )}
          </div>

          <div ref={listTopRef} className="mt-1.5 flex min-h-5 scroll-mt-4 items-center justify-between gap-3 px-1">
            {hasAnyFilter ? (
              <button
                type="button"
                onClick={clearAll}
                className="rounded text-xs font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Clear search and filters
              </button>
            ) : (
              <span />
            )}
            <p className="text-xs tabular-nums text-muted-foreground" role="status" aria-live="polite">
              {pagination
                ? hasAnyFilter
                  ? `${total.toLocaleString()} matching ${total === 1 ? "visit" : "visits"}`
                  : `${total.toLocaleString()} visit records`
                : ""}
            </p>
          </div>
        </div>

        {filtersOpen ? (
          <form
            id="opd-visit-filters"
            onSubmit={applyFilters}
            className="space-y-4 rounded-xl border border-border bg-background p-4"
            aria-label="Filter OPD visits"
          >
            <div className="space-y-1.5">
              <label htmlFor="opd-visit-date-preset" className="text-sm font-medium text-foreground">
                Visit date
              </label>
              <select
                id="opd-visit-date-preset"
                value={draftPreset}
                onChange={(event) => selectPreset(event.target.value as VisitDatePreset)}
                className="flex min-h-11 w-full rounded-md border border-border bg-background px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:max-w-sm sm:text-sm"
              >
                <option value="all">Any date</option>
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="thisWeek">This week (Monday to Sunday)</option>
                <option value="thisMonth">This month</option>
                <option value="thisYear">This year</option>
                <option value="custom">Custom range</option>
              </select>
            </div>

            {draftPreset === "custom" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label htmlFor="opd-date-from" className="text-sm font-medium text-foreground">
                    From
                  </label>
                  <Input
                    id="opd-date-from"
                    type="date"
                    className="min-h-11 text-base sm:text-sm"
                    value={draftRange.dateFrom}
                    onChange={(event) => setDraftRange((range) => ({ ...range, dateFrom: event.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="opd-date-to" className="text-sm font-medium text-foreground">
                    To
                  </label>
                  <Input
                    id="opd-date-to"
                    type="date"
                    className="min-h-11 text-base sm:text-sm"
                    value={draftRange.dateTo}
                    onChange={(event) => setDraftRange((range) => ({ ...range, dateTo: event.target.value }))}
                  />
                </div>
              </div>
            ) : null}

            {filterError ? (
              <p className="text-sm text-destructive" role="alert">
                {filterError}
              </p>
            ) : null}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" className="min-h-11" onClick={resetDateFilter}>
                Clear filters
              </Button>
              <Button type="submit" className="min-h-11">
                Apply filters
              </Button>
            </div>
          </form>
        ) : null}

        {isError ? (
          <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm" role="alert">
            <p className="text-destructive">Unable to load OPD visits.</p>
            <Button type="button" variant="outline" size="sm" className="mt-3 min-h-10" onClick={() => void refetch()}>
              Try again
            </Button>
          </div>
        ) : null}

        {showSkeleton ? (
          <div className="space-y-3" role="status" aria-label="Loading OPD visits" aria-busy="true">
            {[0, 1, 2].map((item) => (
              <div
                key={item}
                className="flex flex-col gap-3 rounded-xl border border-border bg-background p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-5 w-44" />
                  <Skeleton className="h-4 w-56 max-w-full" />
                  <Skeleton className="h-3 w-36" />
                </div>
                <div className="flex items-center gap-3">
                  <Skeleton className="h-7 w-20 rounded-full" />
                  <Skeleton className="h-10 w-16" />
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {showEmpty ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-center sm:p-8">
            <p className="font-medium text-foreground">No OPD visits found</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {hasAnyFilter
                ? "Try a different name or OPD No., or clear the date filter."
                : "No visits have been registered yet."}
            </p>
            <div className="mt-4 flex flex-col justify-center gap-2 sm:flex-row">
              {hasAnyFilter ? (
                <Button type="button" variant="outline" className="min-h-11" onClick={clearAll}>
                  Clear search and filters
                </Button>
              ) : null}
              <Button type="button" className="min-h-11" onClick={() => router.push("/opd-visits/register")}>
                Register a visit
              </Button>
            </div>
          </div>
        ) : null}

        {visits.length > 0 ? (
          <>
            <ul
              className={`space-y-3 transition-opacity ${isRefreshing ? "opacity-60" : "opacity-100"}`}
              aria-busy={isRefreshing}
            >
              {visits.map((visit) => (
                <li key={visit.id}>
                  <article className="flex flex-col gap-4 rounded-xl border border-border bg-background p-4 transition-colors hover:border-primary/40 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">
                        {visit.patient.firstName} {visit.patient.lastName}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                        <span>OPD No. {formatPatientId(visit.patient.patientId)}</span>
                        <span className="inline-flex items-center gap-1.5">
                          <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                          {formatVisitDate(visit.date)}
                        </span>
                        {visit.patient.town ? (
                          <span className="inline-flex min-w-0 items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            <span className="truncate">{visit.patient.town}</span>
                          </span>
                        ) : null}
                      </div>
                      {visit.createdBy ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Registered by {visit.createdBy.firstName} {visit.createdBy.lastName}
                        </p>
                      ) : null}
                      {visit.remarks?.trim() ? (
                        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{visit.remarks}</p>
                      ) : null}
                    </div>
                    <div className="flex items-center justify-between gap-3 sm:justify-end">
                      {visit.newReturning ? (
                        <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium capitalize text-secondary-foreground">
                          {visit.newReturning}
                        </span>
                      ) : (
                        <span />
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        className="min-h-11 min-w-24"
                        aria-label={`View visit for ${visit.patient.firstName} ${visit.patient.lastName}`}
                        onClick={() => router.push(`/opd-visits/${encodeURIComponent(visit.id)}`)}
                      >
                        View
                      </Button>
                    </div>
                  </article>
                </li>
              ))}
            </ul>

            <nav
              aria-label="Visit list pages"
              className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <p className="text-sm text-muted-foreground">
                {total > 0 ? `Showing ${rangeStart}\u2013${rangeEnd} of ${total.toLocaleString()} visits` : "No visits"}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 flex-1 sm:flex-none"
                  disabled={page <= 1 || isRefreshing}
                  onClick={() => goToPage(page - 1)}
                >
                  Previous
                </Button>
                <span className="min-w-24 text-center text-sm tabular-nums text-muted-foreground">
                  Page {page} of {totalPages}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 flex-1 sm:flex-none"
                  disabled={page >= totalPages || isRefreshing}
                  onClick={() => goToPage(page + 1)}
                >
                  Next
                </Button>
              </div>
            </nav>
          </>
        ) : null}
      </div>
    </section>
  );
}
