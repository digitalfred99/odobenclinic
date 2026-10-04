"use client";

import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiRequest } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { PatientListResponse } from "@/types/patient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function PatientSearchList({ className }: { className?: string }) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["patients", searchTerm],
    queryFn: async () => {
      const queryString = searchTerm ? `?search=${encodeURIComponent(searchTerm)}` : "";
      return apiRequest<PatientListResponse>(`/patients${queryString}`);
    },
  });

  const patients = data?.patients ?? [];

  return (
    <div className={cn("space-y-4 rounded-2xl border border-border bg-card p-4 shadow-sm", className)}>
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="pl-9"
            placeholder="Search patients by name, ID, phone or area"
          />
        </div>
        <Button type="button" variant="secondary">Filter</Button>
      </div>

      {error ? <p className="text-sm text-destructive">Unable to load patients.</p> : null}

      {isLoading ? <p className="text-sm text-muted-foreground">Loading patients...</p> : null}

      {!isLoading && patients.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No patients found.
        </div>
      ) : null}

      <div className="space-y-3">
        {patients.map((patient) => (
          <div key={patient.id} className="flex flex-col gap-3 rounded-xl border border-border bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium text-foreground">{patient.firstName} {patient.lastName}</p>
              <p className="text-sm text-muted-foreground">{patient.patientId ?? "Patient"} • {patient.area ?? "N/A"}</p>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => router.push(`/patients/${patient.id}`)}>
                View
              </Button>
              <Button type="button" size="sm" onClick={() => router.push(`/opd-visits?patientId=${encodeURIComponent(patient.id)}`)}>
                Register OPD
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
