"use client";

import { useQuery } from "@tanstack/react-query";
import { format, isValid, parseISO } from "date-fns";
import { Filter, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/api";
import { buildOPDVisitQuery, getVisitDateRange, type VisitDatePreset, type VisitDateRange } from "@/lib/opd-visits";
import type { OPDVisitListResponse } from "@/types/opd";

const PAGE_SIZE = 20;

function formatVisitDate(date: string) {
  const parsedDate = parseISO(date);
  return isValid(parsedDate) ? format(parsedDate, "d MMM yyyy") : date;
}

export default function OPDVisitListPage() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftPreset, setDraftPreset] = useState<VisitDatePreset>("all");
  const [draftRange, setDraftRange] = useState<VisitDateRange>({ dateFrom: "", dateTo: "" });
  const [appliedRange, setAppliedRange] = useState<VisitDateRange>({ dateFrom: "", dateTo: "" });
  const [page, setPage] = useState(1);
  const [filterError, setFilterError] = useState<string | null>(null);
  const query = buildOPDVisitQuery(searchTerm, appliedRange, page, PAGE_SIZE);
  const hasDateFilter = Boolean(appliedRange.dateFrom || appliedRange.dateTo);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["opd-visits", query],
    queryFn: () => apiRequest<OPDVisitListResponse>(`/opd-visits?${query}`),
  });

  const visits = data?.opdVisits ?? [];
  const pagination = data?.pagination;
  const totalPages = pagination?.totalPages ?? 1;
  const total = pagination?.total ?? visits.length;

  const openFilters = () => {
    setDraftRange(appliedRange);
    setDraftPreset(hasDateFilter ? "custom" : "all");
    setFilterError(null);
    setFiltersOpen((open) => !open);
  };

  const selectPreset = (preset: VisitDatePreset) => {
    setDraftPreset(preset);
    setFilterError(null);
    if (preset === "all") {
      setDraftRange({ dateFrom: "", dateTo: "" });
    } else if (preset !== "custom") {
      setDraftRange(getVisitDateRange(preset));
    }
  };

  const applyFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (draftPreset === "custom" && draftRange.dateFrom && draftRange.dateTo && draftRange.dateFrom > draftRange.dateTo) {
      setFilterError("The start date must be on or before the end date.");
      return;
    }

    setAppliedRange(draftRange);
    setPage(1);
    setFilterError(null);
    setFiltersOpen(false);
  };

  const clearFilters = () => {
    setDraftPreset("all");
    setDraftRange({ dateFrom: "", dateTo: "" });
    setAppliedRange({ dateFrom: "", dateTo: "" });
    setFilterError(null);
    setPage(1);
  };

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">OPD visits</p>
          <h2 className="mt-2 text-3xl font-semibold text-foreground">Visit list</h2>
          <p className="mt-2 text-sm text-muted-foreground">Search by patient name, patient ID, or visit date.</p>
        </div>
        <Button type="button" onClick={() => router.push("/opd-visits")}>Register visit</Button>
      </header>

      <div className="space-y-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <Input
              value={searchTerm}
              onChange={(event) => {
                setSearchTerm(event.target.value);
                setPage(1);
              }}
              className="pl-9"
              aria-label="Search OPD visits by patient name, patient ID, or visit date"
              placeholder="Search patient name, patient ID or visit date"
            />
          </div>
          <Button
            type="button"
            variant="secondary"
            aria-expanded={filtersOpen}
            aria-controls={filtersOpen ? "opd-visit-filters" : undefined}
            onClick={openFilters}
          >
            <Filter className="mr-2 h-4 w-4" aria-hidden="true" />
            Filters{hasDateFilter ? " (1)" : ""}
          </Button>
        </div>

        {filtersOpen ? (
          <form
            id="opd-visit-filters"
            onSubmit={applyFilters}
            className="space-y-4 rounded-xl border border-border bg-background p-4"
            aria-label="Filter OPD visits"
          >
            <div className="space-y-1.5">
              <label htmlFor="opd-visit-date-preset" className="text-sm font-medium text-foreground">Visit date</label>
              <select
                id="opd-visit-date-preset"
                value={draftPreset}
                onChange={(event) => selectPreset(event.target.value as VisitDatePreset)}
                className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:max-w-sm"
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
                  <label htmlFor="opd-date-from" className="text-sm font-medium text-foreground">From</label>
                  <Input
                    id="opd-date-from"
                    type="date"
                    value={draftRange.dateFrom}
                    onChange={(event) => setDraftRange((range) => ({ ...range, dateFrom: event.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="opd-date-to" className="text-sm font-medium text-foreground">To</label>
                  <Input
                    id="opd-date-to"
                    type="date"
                    value={draftRange.dateTo}
                    onChange={(event) => setDraftRange((range) => ({ ...range, dateTo: event.target.value }))}
                  />
                </div>
              </div>
            ) : null}

            {filterError ? <p className="text-sm text-destructive" role="alert">{filterError}</p> : null}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={clearFilters}>Clear filters</Button>
              <Button type="submit">Apply filters</Button>
            </div>
          </form>
        ) : null}

        {isError ? (
          <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm" role="alert">
            <p className="text-destructive">Unable to load OPD visits.</p>
            <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => void refetch()}>Try again</Button>
          </div>
        ) : null}

        {isLoading ? (
          <div className="space-y-3" role="status" aria-label="Loading OPD visits" aria-busy="true">
            {[0, 1, 2].map((item) => (
              <div key={item} className="flex flex-col gap-3 rounded-xl border border-border bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-5 w-44" />
                  <Skeleton className="h-4 w-56 max-w-full" />
                  <Skeleton className="h-3 w-36" />
                </div>
                <div className="flex items-center gap-3">
                  <Skeleton className="h-7 w-20 rounded-full" />
                  <Skeleton className="h-9 w-16" />
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {!isLoading && !isError && visits.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center">
            <p className="font-medium text-foreground">No OPD visits found</p>
            <p className="mt-1 text-sm text-muted-foreground">Try another search or clear the date filter.</p>
          </div>
        ) : null}

        {visits.length > 0 ? (
          <>
            <div className="space-y-3">
              {visits.map((visit) => (
                <article key={visit.id} className="flex flex-col gap-3 rounded-xl border border-border bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">{visit.patient.firstName} {visit.patient.lastName}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      OPD No. {visit.patient.patientId ?? "Unavailable"} <span aria-hidden="true">·</span> {formatVisitDate(visit.date)}
                    </p>
                    {visit.createdBy ? (
                      <p className="mt-1 text-xs text-muted-foreground">Registered by {visit.createdBy.firstName} {visit.createdBy.lastName}</p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-3">
                    {visit.newReturning ? (
                      <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium capitalize text-secondary-foreground">{visit.newReturning}</span>
                    ) : null}
                    <Button type="button" size="sm" variant="outline" onClick={() => router.push(`/opd-visits/${encodeURIComponent(visit.id)}`)}>View</Button>
                  </div>
                </article>
              ))}
            </div>

            <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                {total > 0 ? `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} of ${total} visits` : "No visits"}
              </p>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" disabled={page <= 1 || isLoading} onClick={() => setPage((current) => current - 1)}>Previous</Button>
                <span className="min-w-20 text-center text-sm text-muted-foreground">Page {page} of {totalPages}</span>
                <Button type="button" variant="outline" size="sm" disabled={page >= totalPages || isLoading} onClick={() => setPage((current) => current + 1)}>Next</Button>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}
