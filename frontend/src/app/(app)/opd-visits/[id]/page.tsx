"use client";

import { useParams } from "next/navigation";

export default function OPDVisitDetailPage() {
  const params = useParams<{ id: string }>();

  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Attendance record</p>
      <h2 className="mt-3 text-2xl font-semibold text-foreground">Visit {params?.id}</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Detailed OPD visit information and edit controls will be added in the next iteration of the attendance workflow.
      </p>
    </section>
  );
}
