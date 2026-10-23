"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Filter, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { apiRequest } from "@/lib/api";
import { GHANA_REGIONS } from "@/lib/ghana-locations";
import { formatPatientName } from "@/lib/patient-name";
import { usePatientLocationCache } from "@/lib/patient-location-cache";
import { formatPatientDisplayId } from "@/lib/reporting";
import { cn } from "@/lib/utils";
import { PatientAvatar } from "@/components/features/opd/patient-avatar";
import { PATIENT_RELIGIONS, type Patient, type PatientListResponse } from "@/types/patient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

type PatientFilters = {
  gender: string;
  maritalStatus: string;
  religion: string;
  region: string;
  district: string;
  town: string;
  area: string;
  patientId: string;
};

const emptyFilters: PatientFilters = {
  gender: "",
  maritalStatus: "",
  religion: "",
  region: "",
  district: "",
  town: "",
  area: "",
  patientId: "",
};

const PAGE_SIZE = 20;
const filterSelectClass = "flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function buildPatientQuery(searchTerm: string, filters: PatientFilters, page: number) {
  const params = new URLSearchParams();
  const search = searchTerm.trim();

  if (search) params.set("search", search);

  for (const [key, value] of Object.entries(filters)) {
    const normalizedValue = value.trim();
    if (normalizedValue) params.set(key, normalizedValue);
  }

  params.set("page", String(page));
  params.set("limit", String(PAGE_SIZE));

  const query = params.toString();
  return `?${query}`;
}

function patientContactSummary(patient: Patient) {
  return [
    patient.ghCardNumber,
    patient.nhisNumber,
    patient.phone,
  ]
    .map((value) => value?.trim() ?? "")
    .filter(Boolean)
    .join(" • ");
}

function uniqueOptions(values: (string | null | undefined)[], selected: string) {
  const options = new Map<string, string>();
  [...values, selected].forEach((value) => {
    const normalized = value?.trim();
    if (normalized) options.set(normalized.toLocaleLowerCase(), normalized);
  });
  return [...options.values()].sort((first, second) => first.localeCompare(second));
}

export function PatientSearchList({ className }: { className?: string }) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState<PatientFilters>(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState<PatientFilters>(emptyFilters);
  const [page, setPage] = useState(1);
  const { locations: savedLocations } = usePatientLocationCache();
  const debouncedSearchTerm = useDebouncedValue(searchTerm);
  const queryString = buildPatientQuery(debouncedSearchTerm, appliedFilters, page);
  const activeFilterCount = Object.values(appliedFilters).filter((value) => value.trim()).length;
  const isSettlingSearch = searchTerm.trim() !== debouncedSearchTerm.trim();

  const { data, isLoading, isFetching, isPlaceholderData, error } = useQuery({
    queryKey: ["patients", queryString],
    queryFn: ({ signal }) => apiRequest<PatientListResponse>(`/patients${queryString}`, { signal }),
    placeholderData: keepPreviousData,
  });

  const patients = useMemo(() => data?.patients ?? [], [data?.patients]);
  const total = data?.pagination?.total ?? patients.length;
  const totalPages = Math.max(1, data?.pagination?.totalPages ?? 1);
  const isRefreshing = Boolean(data) && (isPlaceholderData || isSettlingSearch);
  const rangeStart = total > 0 ? (page - 1) * PAGE_SIZE + 1 : 0;
  const rangeEnd = Math.min(page * PAGE_SIZE, total);
  const locationRecords = useMemo(
    () => [...savedLocations, ...patients],
    [savedLocations, patients]
  );
  const matchingLocations = useMemo(() => locationRecords.filter((location) =>
    (!draftFilters.region || location.region?.trim().toLocaleLowerCase() === draftFilters.region.toLocaleLowerCase()) &&
    (!draftFilters.district || location.district?.trim().toLocaleLowerCase() === draftFilters.district.toLocaleLowerCase()) &&
    (!draftFilters.town || location.town?.trim().toLocaleLowerCase() === draftFilters.town.toLocaleLowerCase())
  ), [locationRecords, draftFilters.region, draftFilters.district, draftFilters.town]);
  const regionOptions = useMemo(() => uniqueOptions([
    ...GHANA_REGIONS,
    ...locationRecords.map((location) => location.region),
  ], draftFilters.region), [locationRecords, draftFilters.region]);
  const districtOptions = useMemo(() => uniqueOptions(
    matchingLocations.map((location) => location.district),
    draftFilters.district
  ), [matchingLocations, draftFilters.district]);
  const townOptions = useMemo(() => uniqueOptions(
    matchingLocations.map((location) => location.town),
    draftFilters.town
  ), [matchingLocations, draftFilters.town]);
  const areaOptions = useMemo(() => uniqueOptions(
    matchingLocations.map((location) => location.area),
    draftFilters.area
  ), [matchingLocations, draftFilters.area]);
  const locationFilterOptions = {
    region: regionOptions,
    district: districtOptions,
    town: townOptions,
    area: areaOptions,
  };

  const updateLocationFilter = (field: keyof typeof locationFilterOptions, value: string) => {
    setDraftFilters((filters) => ({
      ...filters,
      [field]: value,
      ...(field === "region" ? { district: "", town: "", area: "" } : {}),
      ...(field === "district" ? { town: "", area: "" } : {}),
      ...(field === "town" ? { area: "" } : {}),
    }));
  };

  const toggleFilters = () => {
    if (!filtersOpen) setDraftFilters(appliedFilters);
    setFiltersOpen((open) => !open);
  };

  const applyFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAppliedFilters({
      gender: draftFilters.gender,
      maritalStatus: draftFilters.maritalStatus,
      religion: draftFilters.religion,
      region: draftFilters.region.trim(),
      district: draftFilters.district.trim(),
      town: draftFilters.town.trim(),
      area: draftFilters.area.trim(),
      patientId: draftFilters.patientId.trim(),
    });
    setPage(1);
    setFiltersOpen(false);
  };

  const clearFilters = () => {
    setDraftFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
    setPage(1);
  };

  return (
    <div className={cn("space-y-4 rounded-2xl border border-border bg-card p-4 shadow-sm", className)}>
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(event) => {
              setSearchTerm(event.target.value);
              setPage(1);
            }}
            className="pl-9"
            aria-label="Search patients by name, patient ID, phone, Ghana Card, NHIS, location, age, date of birth, postal address or occupation"
            placeholder="Search names, ID, phone, Ghana Card, NHIS, location, age, DOB, postal address or occupation"
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
            <div className="space-y-1.5">
              <label htmlFor="patient-filter-religion" className="text-sm font-medium text-foreground">Religion</label>
              <select
                id="patient-filter-religion"
                value={draftFilters.religion}
                onChange={(event) => setDraftFilters((filters) => ({ ...filters, religion: event.target.value }))}
                className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Any religion</option>
                {PATIENT_RELIGIONS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>

            {(["region", "district", "town", "area"] as const).map((field) => (
              <div key={field} className="space-y-1.5">
                <label htmlFor={`patient-filter-${field}`} className="text-sm font-medium capitalize text-foreground">{field}</label>
                <select
                  id={`patient-filter-${field}`}
                  value={draftFilters[field]}
                  onChange={(event) => updateLocationFilter(field, event.target.value)}
                  className={filterSelectClass}
                >
                  <option value="">All {field === "area" ? "areas" : `${field}s`}</option>
                  {locationFilterOptions[field].map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
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
          <div key={patient.id} className="relative flex flex-col gap-3 rounded-xl border border-border bg-background p-4 transition-colors hover:border-primary/40 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <div className="absolute right-4 top-4 sm:static sm:shrink-0">
                <PatientAvatar patient={patient} size="large" showPhoto={false} />
              </div>
              <div className="min-w-0 pr-16 sm:pr-0">
                <p className="font-medium text-foreground">{formatPatientName(patient)}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {[
                    `OPD No. ${patient.patientId ? formatPatientDisplayId(patient.patientId) : "unavailable"}`,
                    patient.district,
                    patient.town,
                    patient.area,
                    patient.postalAddress,
                  ]
                    .map((value) => value?.trim())
                    .filter((value): value is string => Boolean(value))
                    .join(" • ")}
                </p>
                {patientContactSummary(patient) ? (
                  <p className="mt-1 break-words text-sm text-muted-foreground">
                    {patientContactSummary(patient)}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <Button type="button" variant="secondary" size="sm" onClick={() => router.push(`/patients/${patient.id}`)}>
                View
              </Button>
              <Button type="button" size="sm" onClick={() => router.push(`/opd-visits/register?patientId=${encodeURIComponent(patient.id)}`)}>
                Register OPD
              </Button>
            </div>
          </div>
        ))}
      </div>

      {data && !error ? (
        <nav
          aria-label="Patient list pages"
          className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="text-sm text-muted-foreground">
            {total > 0 ? `Showing ${rangeStart}\u2013${rangeEnd} of ${total.toLocaleString()} patients` : "No patients"}
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-11 flex-1 sm:flex-none"
              disabled={page <= 1 || isRefreshing || isFetching}
              onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
            >
              Previous
            </Button>
            <span className="min-w-24 text-center text-sm tabular-nums text-muted-foreground" aria-live="polite">
              Page {page} of {totalPages}
            </span>
            <Button
              type="button"
              variant="outline"
              className="min-h-11 flex-1 sm:flex-none"
              disabled={page >= totalPages || isRefreshing || isFetching}
              onClick={() => setPage((currentPage) => Math.min(totalPages, currentPage + 1))}
            >
              Next
            </Button>
          </div>
        </nav>
      ) : null}
    </div>
  );
}
