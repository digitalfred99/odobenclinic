"use client";

import { useQuery } from "@tanstack/react-query";
import { Filter, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { apiRequest } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { PatientListResponse } from "@/types/patient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

type PatientFilters = {
  gender: string;
  maritalStatus: string;
  region: string;
  district: string;
  town: string;
  area: string;
  patientId: string;
};

const emptyFilters: PatientFilters = {
  gender: "",
  maritalStatus: "",
  region: "",
  district: "",
  town: "",
  area: "",
  patientId: "",
};

function buildPatientQuery(searchTerm: string, filters: PatientFilters) {
  const params = new URLSearchParams();
  const search = searchTerm.trim();

  if (search) params.set("search", search);

  for (const [key, value] of Object.entries(filters)) {
    const normalizedValue = value.trim();
    if (normalizedValue) params.set(key, normalizedValue);
  }

  const query = params.toString();
  return query ? `?${query}` : "";
}

export function PatientSearchList({ className }: { className?: string }) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState<PatientFilters>(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState<PatientFilters>(emptyFilters);
  const debouncedSearchTerm = useDebouncedValue(searchTerm);
  const queryString = buildPatientQuery(debouncedSearchTerm, appliedFilters);
  const activeFilterCount = Object.values(appliedFilters).filter((value) => value.trim()).length;

  const { data, isLoading, error } = useQuery({
    queryKey: ["patients", queryString],
    queryFn: ({ signal }) => apiRequest<PatientListResponse>(`/patients${queryString}`, { signal }),
  });

  const patients = data?.patients ?? [];

  const toggleFilters = () => {
    if (!filtersOpen) setDraftFilters(appliedFilters);
    setFiltersOpen((open) => !open);
  };

  const applyFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAppliedFilters({
      gender: draftFilters.gender,
      maritalStatus: draftFilters.maritalStatus,
      region: draftFilters.region.trim(),
      district: draftFilters.district.trim(),
      town: draftFilters.town.trim(),
      area: draftFilters.area.trim(),
      patientId: draftFilters.patientId.trim(),
    });
    setFiltersOpen(false);
  };

  const clearFilters = () => {
    setDraftFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
  };

  return (
    <div className={cn("space-y-4 rounded-2xl border border-border bg-card p-4 shadow-sm", className)}>
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="pl-9"
            aria-label="Search patients by name, patient ID, phone, Ghana Card, NHIS number or area"
            placeholder="Search by name, patient ID, phone, Ghana Card, NHIS or area"
          />
        </div>
        <Button
          type="button"
          variant="secondary"
          aria-expanded={filtersOpen}
          aria-controls={filtersOpen ? "patient-filters" : undefined}
          onClick={toggleFilters}
        >
          <Filter className="mr-2 h-4 w-4" aria-hidden="true" />
          Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
        </Button>
      </div>

      {filtersOpen ? (
        <form
          id="patient-filters"
          onSubmit={applyFilters}
          className="space-y-4 rounded-xl border border-border bg-background p-4"
          aria-label="Filter patients"
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5">
              <label htmlFor="patient-filter-gender" className="text-sm font-medium text-foreground">Gender</label>
              <select
                id="patient-filter-gender"
                value={draftFilters.gender}
                onChange={(event) => setDraftFilters((filters) => ({ ...filters, gender: event.target.value }))}
                className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Any gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="patient-filter-marital-status" className="text-sm font-medium text-foreground">Marital status</label>
              <select
                id="patient-filter-marital-status"
                value={draftFilters.maritalStatus}
                onChange={(event) => setDraftFilters((filters) => ({ ...filters, maritalStatus: event.target.value }))}
                className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Any marital status</option>
                <option value="single">Single</option>
                <option value="married">Married</option>
                <option value="divorced">Divorced</option>
                <option value="widowed">Widowed</option>
              </select>
            </div>

            {(["region", "district", "town", "area"] as const).map((field) => (
              <div key={field} className="space-y-1.5">
                <label htmlFor={`patient-filter-${field}`} className="text-sm font-medium capitalize text-foreground">{field}</label>
                <Input
                  id={`patient-filter-${field}`}
                  value={draftFilters[field]}
                  onChange={(event) => setDraftFilters((filters) => ({ ...filters, [field]: event.target.value }))}
                  placeholder={`Exact ${field} name`}
                />
              </div>
            ))}

            <div className="space-y-1.5">
              <label htmlFor="patient-filter-patient-id" className="text-sm font-medium text-foreground">Patient ID (OPD No.)</label>
              <Input
                id="patient-filter-patient-id"
                value={draftFilters.patientId}
                onChange={(event) => setDraftFilters((filters) => ({ ...filters, patientId: event.target.value }))}
                placeholder="e.g. PT-12/2026"
              />
              <p className="text-xs text-muted-foreground">Matches part of the patient ID.</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Region, district, town, and area are case-insensitive exact matches.</p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={clearFilters}>Clear filters</Button>
            <Button type="submit">Apply filters</Button>
          </div>
        </form>
      ) : null}

      {error ? <p className="text-sm text-destructive">Unable to load patients.</p> : null}

      {isLoading ? (
        <div className="space-y-3" role="status" aria-label="Loading patients" aria-busy="true">
          {[0, 1, 2].map((item) => (
            <div key={item} className="flex flex-col gap-3 rounded-xl border border-border bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-56 max-w-full" />
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-9 w-16" />
                <Skeleton className="h-9 w-28" />
              </div>
            </div>
          ))}
        </div>
      ) : null}

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
