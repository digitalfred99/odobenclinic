"use client";

import { useQuery } from "@tanstack/react-query";
import { format, isValid, parseISO } from "date-fns";
import { ArrowLeft, CalendarDays, ClipboardList, MapPin, Phone, UserRound } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api";
import type { OPDVisit } from "@/types/opd";

function formatDate(value?: string | null) {
  if (!value) return "Not recorded";
  const date = parseISO(value);
  return isValid(date) ? format(date, "EEEE, d MMMM yyyy") : value;
}

function formatTimestamp(value?: string) {
  if (!value) return null;
  const date = parseISO(value);
  return isValid(date) ? format(date, "d MMM yyyy, h:mm a") : value;
}

export default function OPDVisitDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const visitId = params?.id ?? "";
  const { data: visit, isLoading, isError, refetch } = useQuery({
    queryKey: ["opd-visit", visitId],
    queryFn: () => apiRequest<OPDVisit>(`/opd-visits/${encodeURIComponent(visitId)}`),
    enabled: Boolean(visitId),
  });

  const labelClassName = "text-xs font-semibold uppercase tracking-wide text-muted-foreground";
  const valueClassName = "mt-1.5 text-sm font-medium text-foreground";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Back to OPD visit list"
            title="Back to OPD visit list"
            onClick={() => router.push("/opd-visits/list")}
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </Button>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">OPD visit record</p>
            <h2 className="mt-1 truncate text-2xl font-semibold text-foreground sm:text-3xl">
              {visit ? `${visit.patient.firstName} ${visit.patient.lastName}` : "Visit details"}
            </h2>
          </div>
        </div>
        {visit ? (
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={() => window.print()}>
              Print visit
            </Button>
            <Button type="button" onClick={() => router.push(`/patients/${encodeURIComponent(visit.patient.id)}`)}>
              View patient record
            </Button>
          </div>
        ) : null}
      </div>

      {isLoading ? (
        <section className="space-y-5 rounded-2xl border border-border bg-card p-6 shadow-sm" aria-label="Loading visit details" aria-busy="true">
          <div className="h-6 w-48 animate-pulse rounded bg-muted" />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index} className="space-y-2">
                <div className="h-3 w-24 animate-pulse rounded bg-muted" />
                <div className="h-5 w-36 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {isError ? (
        <section className="rounded-2xl border border-destructive/40 bg-card p-6 shadow-sm" role="alert">
          <h3 className="font-semibold text-foreground">Unable to load this visit</h3>
          <p className="mt-1 text-sm text-muted-foreground">The visit may have been removed, or there may be a connection problem.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => void refetch()}>Try again</Button>
            <Button type="button" variant="secondary" onClick={() => router.push("/opd-visits/list")}>Back to visit list</Button>
          </div>
        </section>
      ) : null}

      {visit ? (
        <div className="space-y-5">
          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm print:shadow-none">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
              <div>
                <p className={labelClassName}>Patient</p>
                <h3 className="mt-1 text-xl font-semibold text-foreground">{visit.patient.firstName} {visit.patient.lastName}</h3>
                <p className="mt-1 text-sm text-muted-foreground">OPD No. {visit.patient.patientId ?? "Not available"}</p>
              </div>
              {visit.newReturning ? (
                <span className="rounded-full bg-secondary px-3 py-1 text-sm font-semibold capitalize text-secondary-foreground">
                  {visit.newReturning} patient
                </span>
              ) : null}
            </div>

            <dl className="grid gap-x-6 gap-y-5 pt-5 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <dt className={labelClassName}>Visit date</dt>
                <dd className={`${valueClassName} flex items-center gap-2`}>
                  <CalendarDays className="h-4 w-4 text-primary" aria-hidden="true" />
                  {formatDate(visit.date)}
                </dd>
              </div>
              <div>
                <dt className={labelClassName}>Patient ID</dt>
                <dd className={valueClassName}>{visit.patient.patientId ?? "Not available"}</dd>
              </div>
              <div>
                <dt className={labelClassName}>Visit classification</dt>
                <dd className={`${valueClassName} capitalize`}>{visit.newReturning ?? "Not recorded"}</dd>
              </div>
              <div>
                <dt className={labelClassName}>Patient name</dt>
                <dd className={`${valueClassName} flex items-center gap-2`}>
                  <UserRound className="h-4 w-4 text-primary" aria-hidden="true" />
                  {visit.patient.firstName} {visit.patient.lastName}
                </dd>
              </div>
              <div>
                <dt className={labelClassName}>Phone</dt>
                <dd className={`${valueClassName} flex items-center gap-2`}>
                  <Phone className="h-4 w-4 text-primary" aria-hidden="true" />
                  {visit.patient.phone || "Not provided"}
                </dd>
              </div>
              <div>
                <dt className={labelClassName}>Area</dt>
                <dd className={`${valueClassName} flex items-center gap-2`}>
                  <MapPin className="h-4 w-4 text-primary" aria-hidden="true" />
                  {visit.patient.area || "Not provided"}
                </dd>
              </div>
              <div>
                <dt className={labelClassName}>Registered by</dt>
                <dd className={valueClassName}>
                  {visit.createdBy ? `${visit.createdBy.firstName} ${visit.createdBy.lastName}` : "Not recorded"}
                </dd>
              </div>
              {formatTimestamp(visit.createdAt) ? (
                <div>
                  <dt className={labelClassName}>Record created</dt>
                  <dd className={valueClassName}>{formatTimestamp(visit.createdAt)}</dd>
                </div>
              ) : null}
            </dl>
          </section>

          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm print:shadow-none">
            <h3 className="flex items-center gap-2 font-semibold text-foreground">
              <ClipboardList className="h-5 w-5 text-primary" aria-hidden="true" />
              Visit remarks
            </h3>
            {visit.remarks?.trim() ? (
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-foreground">{visit.remarks}</p>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">No remarks were recorded for this visit.</p>
            )}
          </section>

          <p className="text-xs text-muted-foreground print:hidden">
            OPD No. is the patient&apos;s permanent ID; this visit is identified by that ID and the visit date.
          </p>
        </div>
      ) : null}
    </div>
  );
}
