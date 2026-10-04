"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Filter, Search } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AuditLog, AuditLogsResponse } from "@/types/audit";

const ACTIONS = [
  "PATIENT_REGISTERED",
  "PATIENT_PROFILE_UPDATED",
  "PATIENT_DELETED",
  "OPD_VISIT_CREATED",
  "OPD_VISIT_UPDATED",
  "OPD_VISIT_DELETED",
  "USER_REGISTERED",
  "USER_EDITED",
  "USER_DELETED",
  "USER_DEACTIVATED",
  "PASSWORD_CHANGED",
  "PHONE_CHANGED",
  "EMAIL_CHANGED",
  "LOGIN_SUCCESS",
  "LOGIN_FAILED",
  "LOGOUT",
];

const ENTITY_TYPES = ["PATIENT", "OPDVISIT", "USER"];

export default function AuditLogsPage() {
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [actorId, setActorId] = useState("");
  const [page, setPage] = useState(1);

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (action) params.set("action", action);
    if (entityType) params.set("entityType", entityType);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (actorId) params.set("actorUserId", actorId);
    params.set("page", String(page));
    params.set("limit", "20");
    return params;
  }, [action, actorId, entityType, from, page, to]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["audit-logs", queryParams.toString()],
    queryFn: async () => apiRequest<AuditLogsResponse>(`/audit-logs?${queryParams.toString()}`),
  });

  const logs = data?.logs ?? [];
  const totalPages = data?.pagination?.totalPages ?? 1;

  const resetFilters = () => {
    setAction("");
    setEntityType("");
    setFrom("");
    setTo("");
    setActorId("");
    setPage(1);
  };

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Audit log</p>
        <h2 className="mt-2 text-3xl font-semibold text-foreground">Staff activity</h2>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2 text-primary">
          <Filter className="h-4 w-4" />
          <span className="text-sm font-medium">Filters</span>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Action</label>
            <select value={action} onChange={(event) => setAction(event.target.value)} className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
              <option value="">All</option>
              {ACTIONS.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Entity</label>
            <select value={entityType} onChange={(event) => setEntityType(event.target.value)} className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
              <option value="">All</option>
              {ENTITY_TYPES.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">From</label>
            <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">To</label>
            <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Actor ID</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={actorId} onChange={(event) => setActorId(event.target.value)} className="pl-9" placeholder="UUID" />
            </div>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={resetFilters}>Reset</Button>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        {error ? <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">Unable to load audit logs.</div> : null}

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((item) => <div key={item} className="h-14 animate-pulse rounded-xl bg-muted" />)}
          </div>
        ) : logs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No audit events found for the current filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="px-3 py-3 font-medium">Time</th>
                  <th className="px-3 py-3 font-medium">Actor</th>
                  <th className="px-3 py-3 font-medium">Action</th>
                  <th className="px-3 py-3 font-medium">Entity</th>
                  <th className="px-3 py-3 font-medium">Metadata</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log: AuditLog) => (
                  <tr key={log.id} className="border-b border-border last:border-0 align-top">
                    <td className="px-3 py-3 whitespace-nowrap text-foreground">{new Date(log.createdAt).toLocaleString()}</td>
                    <td className="px-3 py-3 text-foreground">{log.actor ? `${log.actor.firstName} ${log.actor.lastName}` : "—"}</td>
                    <td className="px-3 py-3 text-foreground">{log.action}</td>
                    <td className="px-3 py-3 text-foreground">{log.entityType}</td>
                    <td className="px-3 py-3 text-muted-foreground">
                      {log.metadata ? <span className="inline-block max-w-xs break-words">{JSON.stringify(log.metadata)}</span> : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {logs.length > 0 ? (
          <div className="mt-5 flex items-center justify-between gap-3 text-sm text-muted-foreground">
            <span>Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</Button>
              <Button type="button" variant="secondary" disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>Next</Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
