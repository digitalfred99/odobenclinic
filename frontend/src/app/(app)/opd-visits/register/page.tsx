"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, isValid, parseISO } from "date-fns";
import { CalendarDays, CheckCircle2, ChevronDown, ChevronRight, Loader2, Search, Undo2, UserRound, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { apiRequest } from "@/lib/api";
import { formatPatientName } from "@/lib/patient-name";
import { buildOPDVisitQuery, type VisitDateRange } from "@/lib/opd-visits";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type { Patient } from "@/types/patient";
import type { OPDVisit, OPDVisitListResponse } from "@/types/opd";

type PatientsLookupResponse = {
  patients: Patient[];
  pagination?: {
    total?: number;
    page?: number;
    limit?: number;
    totalPages?: number;
  };
};

/* Optional fields. If your Patient type already has them, nothing changes;
   if it does not, they are simply skipped at runtime. */
type PatientWithMeta = Patient & {
  age?: number | string | null;
  gender?: string | null;
  sex?: string | null;
};

const REMARKS_LIMIT = 500;
const EMPTY_RANGE: VisitDateRange = { dateFrom: "", dateTo: "" };
const SEARCH_RESULTS_ID = "opd-patient-results";
const SUCCESS_AUTO_CLOSE_MS = 8000;

function formatPatientId(patientId?: string) {
  return patientId?.replace(/^PT-/, "") || "ID unavailable";
}

function todayAsLocalDate() {
  return format(new Date(), "yyyy-MM-dd");
}

function optionId(patientId: string) {
  return `opd-patient-option-${patientId}`;
}

/** Second identifier (age and sex) so two people with the same name are easy to tell apart. */
function identityLine(patient: Patient) {
  const p = patient as PatientWithMeta;
  const parts: string[] = [];

  const age = p.age;
  if (age !== undefined && age !== null && String(age).trim() !== "") {
    parts.push(`${age} yrs`);
  }

  const sex = p.gender ?? p.sex;
  if (sex) {
    const text = String(sex);
    parts.push(text.charAt(0).toUpperCase() + text.slice(1).toLowerCase());
  }

  return parts.join(", ");
}

function contactDetails(patient: Patient) {
  return [patient.phone, patient.town, patient.area].filter(
    (value): value is string => typeof value === "string" && value.trim().length > 0
  );
}

function formatVisitDate(date: string) {
  const parsedDate = parseISO(date);
  return isValid(parsedDate) ? format(parsedDate, "d MMM yyyy") : date;
}

function PatientDetailsDialog({
  patient,
  canSelect,
  onSelect,
  onClose,
}: {
  patient: Patient;
  canSelect: boolean;
  onSelect: (patient: Patient) => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [expandedId, setExpandedId] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    const element = dialogRef.current;
    if (element && !element.open && typeof element.showModal === "function") {
      element.showModal();
    }
  }, []);

  const closeDialog = () => dialogRef.current?.close();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["patient-visits", patient.id, "preview"],
    queryFn: ({ signal }) =>
      apiRequest<OPDVisitListResponse>(
        `/opd-visits?${buildOPDVisitQuery(String(patient.patientId ?? ""), EMPTY_RANGE, 1, 10)}`,
        { signal }
      ),
    enabled: Boolean(patient.patientId),
  });

  const visits = (data?.opdVisits ?? []).filter((visit) => visit.patient?.id === patient.id);
  const openId = expandedId === undefined ? visits[0]?.id ?? null : expandedId;

  const facts = [
    { label: "OPD No.", value: formatPatientId(patient.patientId) },
    { label: "Age and sex", value: identityLine(patient) },
    { label: "Phone", value: String(patient.phone ?? "") },
    { label: "Town", value: String(patient.town ?? "") },
    { label: "Area", value: String(patient.area ?? "") },
  ].filter((fact) => fact.value.trim().length > 0);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="patient-details-title"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) closeDialog();
      }}
      className="m-auto max-h-[85dvh] w-[calc(100%-2rem)] max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-card p-0 text-foreground shadow-xl backdrop:bg-black/50 open:flex max-sm:mb-0 max-sm:mt-auto max-sm:max-h-[90dvh] max-sm:w-full max-sm:max-w-none max-sm:rounded-b-none"
    >
      <div className="flex items-start justify-between gap-3 border-b border-border p-4 sm:p-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <UserRound className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 id="patient-details-title" className="truncate text-lg font-semibold text-foreground">
              {formatPatientName(patient)}
            </h2>
            <p className="text-sm text-muted-foreground">Patient details and attendance history</p>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-11 w-11 shrink-0"
          aria-label="Close details"
          onClick={closeDialog}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 sm:p-5">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          {facts.map((fact) => (
            <div key={fact.label} className="min-w-0">
              <dt className="text-xs text-muted-foreground">{fact.label}</dt>
              <dd className="mt-0.5 break-words font-medium text-foreground">{fact.value}</dd>
            </div>
          ))}
        </dl>

        <section aria-labelledby="patient-history-heading" className="space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <h3 id="patient-history-heading" className="text-sm font-semibold text-foreground">
              Attendance history
            </h3>
            {!isLoading && !isError ? (
              <span className="text-xs text-muted-foreground">
                {visits.length} {visits.length === 1 ? "visit" : "visits"}
              </span>
            ) : null}
          </div>

          {isLoading ? (
            <div className="space-y-2" role="status" aria-label="Loading attendance history" aria-busy="true">
              {[0, 1, 2].map((item) => (
                <Skeleton key={item} className="h-12 w-full rounded-xl" />
              ))}
            </div>
          ) : null}

          {isError ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4" role="alert">
              <p className="text-sm text-destructive">Unable to load attendance history.</p>
              <Button type="button" variant="outline" size="sm" className="mt-3 min-h-10" onClick={() => void refetch()}>
                Try again
              </Button>
            </div>
          ) : null}

          {!isLoading && !isError && visits.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
              No earlier visits recorded for this patient.
            </p>
          ) : null}

          {visits.length > 0 ? (
            <ul className="space-y-2">
              {visits.map((visit) => {
                const isOpen = openId === visit.id;
                const detailId = `visit-detail-${visit.id}`;
                return (
                  <li key={visit.id} className="rounded-xl border border-border bg-background">
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      aria-controls={detailId}
                      onClick={() => setExpandedId(isOpen ? null : visit.id)}
                      className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl px-4 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
                        <CalendarDays className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                        {formatVisitDate(visit.date)}
                      </span>
                      <span className="inline-flex items-center gap-2">
                        {visit.newReturning ? (
                          <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium capitalize text-secondary-foreground">
                            {visit.newReturning}
                          </span>
                        ) : null}
                        <ChevronDown
                          className={`h-4 w-4 text-muted-foreground transition-transform motion-reduce:transition-none ${
                            isOpen ? "rotate-180" : ""
                          }`}
                          aria-hidden="true"
                        />
                      </span>
                    </button>
                    {isOpen ? (
                      <div id={detailId} className="space-y-2 border-t border-border px-4 py-3 text-sm">
                        {visit.patient?.town ? (
                          <p className="text-muted-foreground">Town: {visit.patient.town}</p>
                        ) : null}
                        {visit.createdBy ? (
                          <p className="text-muted-foreground">
                            Registered by {visit.createdBy.firstName} {visit.createdBy.lastName}
                          </p>
                        ) : null}
                        <p className="whitespace-pre-wrap break-words text-foreground">
                          {visit.remarks?.trim() ? visit.remarks : <span className="text-muted-foreground">No remarks.</span>}
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="min-h-10"
                          onClick={() => router.push(`/opd-visits/${encodeURIComponent(visit.id)}`)}
                        >
                          Open full record
                        </Button>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : null}
        </section>
      </div>

      <div className="flex gap-2 border-t border-border p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-5">
        <Button type="button" variant="outline" className="min-h-11 flex-1" onClick={closeDialog}>
          Close
        </Button>
        {canSelect ? (
          <Button
            type="button"
            className="min-h-11 flex-1"
            onClick={() => {
              onSelect(patient);
              closeDialog();
            }}
          >
            Select patient
          </Button>
        ) : null}
      </div>
    </dialog>
  );
}

function OPDVisitRegistrationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedPatientId, setSelectedPatientId] = useState(() => searchParams.get("patientId") ?? "");
  const [date, setDate] = useState(todayAsLocalDate);
  const [remarks, setRemarks] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [undoError, setUndoError] = useState<string | null>(null);
  const [lastCreatedVisit, setLastCreatedVisit] = useState<OPDVisit | null>(null);
  const [undoDialogOpen, setUndoDialogOpen] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [detailsPatient, setDetailsPatient] = useState<Patient | null>(null);

  const debouncedSearchTerm = useDebouncedValue(searchTerm);

  const searchRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const remarksRef = useRef<HTMLTextAreaElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const submittingRef = useRef(false);
  const skipRefocusRef = useRef(false);
  const hadInitialPatientRef = useRef(Boolean(selectedPatientId));

  const trimmedSearch = searchTerm.trim();
  const isSettling = trimmedSearch !== debouncedSearchTerm.trim();

  const {
    data,
    isFetching,
    isError: isSearchError,
    refetch: refetchPatients,
  } = useQuery({
    queryKey: ["opd-patients", debouncedSearchTerm],
    queryFn: async ({ signal }) => {
      const queryString = debouncedSearchTerm.trim()
        ? `?search=${encodeURIComponent(debouncedSearchTerm.trim())}&limit=8`
        : "?limit=8";
      return apiRequest<PatientsLookupResponse>(`/patients${queryString}`, { signal });
    },
    enabled: Boolean(debouncedSearchTerm.trim()),
  });

  const {
    data: selectedPatientData,
    isLoading: isSelectedPatientLoading,
    isError: isSelectedPatientError,
    refetch: refetchSelectedPatient,
  } = useQuery({
    queryKey: ["opd-selected-patient", selectedPatientId],
    queryFn: ({ signal }) => apiRequest<Patient>(`/patients/${encodeURIComponent(selectedPatientId)}`, { signal }),
    enabled: Boolean(selectedPatientId),
  });

  const patients = useMemo(() => data?.patients ?? [], [data?.patients]);

  /* Never show results for text that has already been cleared. */
  const visiblePatients = useMemo(() => (trimmedSearch ? patients : []), [trimmedSearch, patients]);
  const safeActiveIndex = Math.min(activeIndex, Math.max(visiblePatients.length - 1, 0));

  const showSkeleton = Boolean(trimmedSearch) && (isSettling || isFetching) && visiblePatients.length === 0 && !isSearchError;
  const showNoResults =
    Boolean(trimmedSearch) && !isSettling && !isFetching && !isSearchError && visiblePatients.length === 0;
  const showList = visiblePatients.length > 0;
  const totalMatches = data?.pagination?.total;

  const selectedPatient = useMemo(
    () => patients.find((patient) => patient.id === selectedPatientId) ?? selectedPatientData ?? null,
    [patients, selectedPatientData, selectedPatientId]
  );

  const isBackdated = Boolean(date) && date !== todayAsLocalDate();

  /* Focus the search box on laptops when the page opens (not on phones, where it would raise the keyboard). */
  useEffect(() => {
    if (hadInitialPatientRef.current) return;
    if (window.matchMedia("(min-width: 1024px)").matches) {
      searchRef.current?.focus();
    }
  }, []);

  /* Press "/" anywhere to jump to the search box. */
  useEffect(() => {
    const onKeyDown = (event: WindowEventMap["keydown"]) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target?.isContentEditable) return;
      if (dialogRef.current?.open) return;
      event.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  /* Open and close the native confirmation dialog. */
  useEffect(() => {
    const element = dialogRef.current;
    if (!element) return;
    if (successOpen && !element.open && typeof element.showModal === "function") {
      element.showModal();
      element.querySelector<HTMLButtonElement>("[data-next-patient]")?.focus();
    }
    if (!successOpen && element.open) {
      element.close();
    }
  }, [successOpen]);

  /* The confirmation closes itself so the queue keeps moving. */
  useEffect(() => {
    if (!successOpen) return;
    const timer = window.setTimeout(() => setSuccessOpen(false), SUCCESS_AUTO_CLOSE_MS);
    return () => window.clearTimeout(timer);
  }, [successOpen]);

  const scrollToForm = () => {
    if (!window.matchMedia("(max-width: 1023px)").matches) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    });
  };

  const handleSelectPatient = (patient: Patient) => {
    setSelectedPatientId(patient.id);
    setSearchTerm("");
    setActiveIndex(0);
    setError(null);
    router.replace(`/opd-visits/register?patientId=${encodeURIComponent(patient.id)}`, { scroll: false });

    if (window.matchMedia("(min-width: 1024px)").matches) {
      requestAnimationFrame(() => remarksRef.current?.focus());
    } else {
      scrollToForm();
    }
  };

  const clearSelectedPatient = () => {
    setSelectedPatientId("");
    router.replace("/opd-visits/register", { scroll: false });
    searchRef.current?.focus();
  };

  const invalidateVisitQueries = (patientId?: string) => {
    void queryClient.invalidateQueries({ queryKey: ["opd-visits"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard-overview"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard-new-patients"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard-weekly-opd"] });
    if (patientId) {
      void queryClient.invalidateQueries({ queryKey: ["patient-visits", patientId] });
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submittingRef.current) return;

    setNotice(null);
    setError(null);

    if (!selectedPatientId) {
      setError("Choose a patient before registering the visit.");
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);

    try {
      const response = await apiRequest<OPDVisit>("/opd-visits", {
        method: "POST",
        body: JSON.stringify({
          patient: selectedPatientId,
          date: date || undefined,
          remarks: remarks.trim() || undefined,
        }),
      });

      setLastCreatedVisit(response);
      setSuccessOpen(true);
      setSelectedPatientId("");
      setRemarks("");
      setDate(todayAsLocalDate());
      setSearchTerm("");
      setActiveIndex(0);
      router.replace("/opd-visits/register", { scroll: false });
      invalidateVisitQueries(response.patient?.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to register OPD visit.");
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const clearForm = () => {
    setSelectedPatientId("");
    setDate(todayAsLocalDate());
    setRemarks("");
    setError(null);
    setNotice(null);
    setSearchTerm("");
    setActiveIndex(0);
    router.replace("/opd-visits/register", { scroll: false });
    searchRef.current?.focus();
  };

  const undoLastVisit = async () => {
    if (!lastCreatedVisit) return;
    const visit = lastCreatedVisit;

    await apiRequest("/opd-visits", {
      method: "DELETE",
      body: JSON.stringify({ ids: [visit.id] }),
    });

    setLastCreatedVisit(null);
    setNotice("The last OPD visit was successfully undone.");
    setError(null);
    invalidateVisitQueries(visit.patient?.id);
  };

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      if (searchTerm) {
        event.preventDefault();
        setSearchTerm("");
        setActiveIndex(0);
      }
      return;
    }

    if (!visiblePatients.length) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex(Math.min(safeActiveIndex + 1, visiblePatients.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex(Math.max(safeActiveIndex - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const patient = visiblePatients[safeActiveIndex];
      if (patient) handleSelectPatient(patient);
    }
  };

  const closeSuccess = () => setSuccessOpen(false);

  const handleSuccessClosed = () => {
    setSuccessOpen(false);
    if (skipRefocusRef.current) {
      skipRefocusRef.current = false;
      return;
    }
    requestAnimationFrame(() => searchRef.current?.focus());
  };

  const selectedIdentity = selectedPatient ? identityLine(selectedPatient) : "";

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 sm:space-y-6">
      <header className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="min-w-0">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Register a visit</h2>
          <p className="mt-1.5 hidden max-w-2xl text-sm leading-6 text-muted-foreground sm:block">
            Find the patient, confirm who they are, then record today&apos;s attendance and any remarks that will help
            with follow-up.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="min-h-11 w-full sm:w-auto"
          onClick={() => router.push("/opd-visits")}
        >
          View visit list
        </Button>
      </header>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_24rem] xl:grid-cols-[minmax(0,1fr)_28rem]">
        {/* Step 1: find the patient */}
        <section
          className="space-y-4 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6"
          aria-labelledby="find-patient-heading"
        >
          <div className="flex items-start gap-3">
            <span
              className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground"
              aria-hidden="true"
            >
              1
            </span>
            <div className="min-w-0">
              <h3 id="find-patient-heading" className="text-lg font-semibold leading-7 text-foreground">
                Find a patient
              </h3>
              <p className="text-sm text-muted-foreground">Search by name, other name, OPD No., phone number or area.</p>
            </div>
          </div>

          <div role="search">
            <label htmlFor="patient-search" className="text-sm font-semibold text-foreground">
              Search for a patient
            </label>
            <div className="mt-2 flex h-14 items-center rounded-xl border-2 border-primary/40 bg-background pl-4 pr-2 shadow-sm transition focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/15">
              <Search className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
              <input
                id="patient-search"
                ref={searchRef}
                type="text"
                role="combobox"
                aria-expanded={showList}
                aria-controls={showList ? SEARCH_RESULTS_ID : undefined}
                aria-autocomplete="list"
                aria-activedescendant={showList && visiblePatients[safeActiveIndex] ? optionId(visiblePatients[safeActiveIndex].id) : undefined}
                value={searchTerm}
                onChange={(event) => {
                  setSearchTerm(event.target.value);
                  setActiveIndex(0);
                }}
                onKeyDown={handleSearchKeyDown}
                inputMode="search"
                enterKeyHint="search"
                autoComplete="off"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                placeholder="Type a name, other name, OPD No., phone or area"
                className="h-full min-w-0 flex-1 bg-transparent px-3 text-base text-foreground outline-none placeholder:text-muted-foreground"
              />
              {isFetching || isSettling ? (
                trimmedSearch ? (
                  <Loader2 className="mr-2 h-4 w-4 shrink-0 animate-spin text-muted-foreground" aria-hidden="true" />
                ) : null
              ) : null}
              {searchTerm ? (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => {
                    setSearchTerm("");
                    setActiveIndex(0);
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
          </div>

          <p className="sr-only" role="status" aria-live="polite">
            {showList ? `${visiblePatients.length} matching patients. Use the arrow keys and Enter to choose one.` : ""}
          </p>

          <div className="space-y-3">
            {!trimmedSearch ? (
              <div
                className={`rounded-xl border border-dashed border-border p-4 text-sm leading-6 text-muted-foreground sm:p-5 ${
                  selectedPatientId ? "max-lg:hidden" : ""
                }`}
              >
                Start typing to see matching patients. Use the arrow keys and Enter to choose one.
              </div>
            ) : null}

            {showSkeleton ? (
              <div className="space-y-3" role="status" aria-label="Loading patient matches" aria-busy="true">
                {[0, 1, 2].map((item) => (
                  <div key={item} className="space-y-3 rounded-xl border border-border bg-background p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="space-y-2">
                        <Skeleton className="h-5 w-40" />
                        <Skeleton className="h-4 w-28" />
                      </div>
                      <Skeleton className="h-7 w-16 rounded-full" />
                    </div>
                    <div className="flex gap-4">
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {showNoResults ? (
              <div className="rounded-xl border border-dashed border-border p-4 text-sm leading-6 text-muted-foreground sm:p-5">
                <p className="font-medium text-foreground">No patient found for &ldquo;{trimmedSearch}&rdquo;.</p>
                <p className="mt-1">Check the spelling, or try the OPD No. or phone number instead.</p>
              </div>
            ) : null}

            {isSearchError ? (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4" role="alert">
                <p className="text-sm text-destructive">Unable to search patient records.</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3 min-h-10"
                  onClick={() => void refetchPatients()}
                >
                  Try again
                </Button>
              </div>
            ) : null}

            {showList ? (
              <ul id={SEARCH_RESULTS_ID} role="listbox" aria-label="Matching patients" className="space-y-2.5">
                {visiblePatients.map((patient, index) => {
                  const isActive = index === safeActiveIndex;
                  const identity = identityLine(patient);
                  const details = contactDetails(patient);

                  return (
                    <li
                      key={patient.id}
                      id={optionId(patient.id)}
                      role="option"
                      aria-selected={isActive}
                      onMouseDown={(event) => event.preventDefault()}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => handleSelectPatient(patient)}
                      className={`flex min-h-16 cursor-pointer flex-col gap-2 rounded-xl border p-4 transition ${
                        isActive
                          ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                          : "border-border bg-background hover:border-primary/50"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">
                            {formatPatientName(patient)}
                          </p>
                          <p className="mt-0.5 truncate text-sm text-muted-foreground">
                            OPD No. {formatPatientId(patient.patientId)}
                            {identity ? ` \u00B7 ${identity}` : ""}
                          </p>
                        </div>
                        <span
                          className={`inline-flex shrink-0 items-center rounded-full px-3 py-1 text-xs font-semibold ${
                            isActive ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
                          }`}
                        >
                          Select
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 flex-1 flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          {details.map((detail, detailIndex) => (
                            <span key={`${detailIndex}-${detail}`} className="max-w-full truncate">
                              {detail}
                            </span>
                          ))}
                        </div>
                        <button
                          type="button"
                          aria-label={`More details for ${formatPatientName(patient)}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            setDetailsPatient(patient);
                          }}
                          className="-my-1 -mr-1 inline-flex min-h-10 shrink-0 items-center gap-0.5 rounded-lg px-2.5 text-sm font-medium text-primary transition hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          More
                          <ChevronRight className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : null}

            {showList && typeof totalMatches === "number" && totalMatches > visiblePatients.length ? (
              <p className="text-xs leading-5 text-muted-foreground">
                Showing {visiblePatients.length} of {totalMatches} matches. Add a phone number or area to narrow it down.
              </p>
            ) : null}
          </div>
        </section>

        {/* Step 2: confirm the visit */}
        <form
          ref={formRef}
          onSubmit={handleSubmit}
          aria-busy={isSubmitting}
          className="scroll-mt-4 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6 lg:sticky lg:top-6"
        >
          <fieldset disabled={isSubmitting} className="min-w-0 space-y-5 border-0 p-0">
            <div className="flex items-start gap-3">
              <span
                className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground"
                aria-hidden="true"
              >
                2
              </span>
              <div className="min-w-0">
                <h3 className="text-lg font-semibold leading-7 text-foreground">Confirm visit details</h3>
                <p className="text-sm text-muted-foreground">The OPD No. stays with this patient for every visit.</p>
              </div>
            </div>

            <div className="space-y-2">
              <p id="selected-patient-label" className="text-sm font-medium text-foreground">
                Selected patient
              </p>
              <div
                role="group"
                aria-labelledby="selected-patient-label"
                aria-live="polite"
                className={`min-h-16 rounded-xl border px-4 py-3 ${
                  selectedPatient
                    ? "border-primary/40 bg-primary/5 text-foreground"
                    : "border-dashed border-border bg-background text-muted-foreground"
                }`}
              >
                {selectedPatient ? (
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <UserRound className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-semibold">
                          {formatPatientName(selectedPatient)}
                        </p>
                        <p className="mt-0.5 truncate text-sm text-muted-foreground">
                          OPD No. {formatPatientId(selectedPatient.patientId)}
                          {selectedIdentity ? ` \u00B7 ${selectedIdentity}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center">
                      <button
                        type="button"
                        aria-label={`More details for ${formatPatientName(selectedPatient)}`}
                        onClick={() => setDetailsPatient(selectedPatient)}
                        className="inline-flex min-h-10 items-center gap-0.5 rounded-lg px-2.5 text-sm font-medium text-primary transition hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        More
                        <ChevronRight className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-11 w-11 shrink-0"
                        aria-label="Clear selected patient"
                        onClick={clearSelectedPatient}
                      >
                        <X className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </div>
                  </div>
                ) : selectedPatientId && isSelectedPatientLoading ? (
                  <span role="status" aria-label="Loading selected patient" aria-busy="true" className="block py-1">
                    <Skeleton className="h-4 w-52 max-w-full" />
                  </span>
                ) : selectedPatientId && isSelectedPatientError ? (
                  <div className="flex flex-wrap items-center justify-between gap-2" role="alert">
                    <span className="text-sm text-destructive">Unable to load the selected patient.</span>
                    <span className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="min-h-10"
                        onClick={() => void refetchSelectedPatient()}
                      >
                        Try again
                      </Button>
                      <Button type="button" variant="ghost" size="sm" className="min-h-10" onClick={clearSelectedPatient}>
                        Clear
                      </Button>
                    </span>
                  </div>
                ) : (
                  <span className="block py-1 text-sm">No patient selected yet.</span>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="visit-date" className="text-sm font-medium text-foreground">
                Visit date
              </label>
              <Input
                id="visit-date"
                type="date"
                max={todayAsLocalDate()}
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className={`min-h-11 text-base sm:text-sm ${isBackdated ? "border-warning ring-2 ring-warning/30" : ""}`}
              />
              {isBackdated ? (
                <p className="text-xs font-medium text-warning" role="status">
                  This is not today&apos;s date. Check it before registering.
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-3">
                <label htmlFor="visit-remarks" className="text-sm font-medium text-foreground">
                  Remarks <span className="font-normal text-muted-foreground">(optional)</span>
                </label>
                <span className="text-xs tabular-nums text-muted-foreground" aria-hidden="true">
                  {remarks.length}/{REMARKS_LIMIT}
                </span>
              </div>
              <textarea
                id="visit-remarks"
                ref={remarksRef}
                value={remarks}
                maxLength={REMARKS_LIMIT}
                onChange={(event) => setRemarks(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
                rows={4}
                className="flex w-full resize-y rounded-md border border-border bg-background px-3 py-3 text-base placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:text-sm"
                placeholder="Notes to help with follow-up"
              />
              <p className="hidden text-xs text-muted-foreground lg:block">Press Ctrl + Enter to register the visit.</p>
            </div>

            {error ? <FeedbackMessage message={error} kind="error" onDismiss={() => setError(null)} /> : null}
            {notice ? <FeedbackMessage message={notice} kind="success" onDismiss={() => setNotice(null)} /> : null}

            <div className="-mx-4 -mb-4 flex flex-col gap-3 border-t border-border bg-card px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 max-sm:sticky max-sm:bottom-0 max-sm:rounded-b-2xl sm:mx-0 sm:mb-0 sm:flex-row sm:items-center sm:justify-between sm:px-0 sm:pb-0">
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" className="min-h-11 flex-1 sm:flex-none" onClick={clearForm}>
                  Clear
                </Button>
                {lastCreatedVisit ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11 flex-1 border-warning/40 text-foreground sm:flex-none"
                    onClick={() => {
                      setUndoError(null);
                      setUndoDialogOpen(true);
                    }}
                  >
                    <Undo2 className="mr-2 h-4 w-4" aria-hidden="true" />
                    Undo last visit
                  </Button>
                ) : null}
              </div>
              <Button type="submit" className="min-h-12 w-full text-base sm:min-h-11 sm:w-auto sm:min-w-44 sm:text-sm" disabled={!selectedPatientId || isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                    Registering…
                  </>
                ) : (
                  "Register visit"
                )}
              </Button>
            </div>
          </fieldset>
        </form>
      </div>

      {detailsPatient ? (
        <PatientDetailsDialog
          patient={detailsPatient}
          canSelect={detailsPatient.id !== selectedPatientId}
          onSelect={handleSelectPatient}
          onClose={() => setDetailsPatient(null)}
        />
      ) : null}

      {/* Success pop-up: bottom sheet on phones, centred card on laptops */}
      <dialog
        ref={dialogRef}
        aria-labelledby="visit-saved-title"
        aria-describedby="visit-saved-description"
        onClose={handleSuccessClosed}
        onClick={(event) => {
          if (event.target === event.currentTarget) closeSuccess();
        }}
        className="m-auto w-[calc(100%-2rem)] max-w-sm overflow-hidden rounded-2xl border border-border bg-card p-0 text-foreground shadow-xl backdrop:bg-black/50 max-sm:mb-0 max-sm:mt-auto max-sm:w-full max-sm:max-w-none max-sm:rounded-b-none"
      >
        <div className="flex flex-col items-center gap-4 p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-success/10">
            <CheckCircle2 className="h-8 w-8 text-success" aria-hidden="true" />
          </span>
          <div className="space-y-1.5">
            <h2 id="visit-saved-title" className="text-lg font-semibold text-foreground">
              Attendance saved
            </h2>
            {lastCreatedVisit ? (
              <div id="visit-saved-description" className="space-y-0.5">
                <p className="text-base font-medium text-foreground">
                  {formatPatientName(lastCreatedVisit.patient)}
                </p>
                <p className="text-sm text-muted-foreground">
                  OPD No. {formatPatientId(lastCreatedVisit.patient?.patientId)}
                  {lastCreatedVisit.newReturning ? ` \u00B7 ${lastCreatedVisit.newReturning} visit` : ""}
                </p>
              </div>
            ) : (
              <p id="visit-saved-description" className="text-sm text-muted-foreground">
                The visit has been recorded.
              </p>
            )}
          </div>
          <div className="flex w-full gap-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-11 flex-1"
              onClick={() => {
                skipRefocusRef.current = true;
                setUndoError(null);
                setSuccessOpen(false);
                setUndoDialogOpen(true);
              }}
            >
              <Undo2 className="mr-2 h-4 w-4" aria-hidden="true" />
              Undo
            </Button>
            <Button type="button" data-next-patient="" className="min-h-11 flex-1" onClick={closeSuccess}>
              Next patient
            </Button>
          </div>
        </div>
      </dialog>

      <ConfirmationDialog
        open={undoDialogOpen}
        title="Undo the last OPD visit?"
        description="This will remove the visit from active records. The patient record will remain unchanged."
        confirmLabel="Undo visit"
        errorMessage={undoError}
        onOpenChange={setUndoDialogOpen}
        onConfirm={undoLastVisit}
        onError={(undoFailure) =>
          setUndoError(undoFailure instanceof Error ? undoFailure.message : "Unable to undo the visit.")
        }
      />
    </div>
  );
}

export default function OPDVisitRegistrationPage() {
  return (
    <Suspense
      fallback={
        <section className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
          Preparing visit registration…
        </section>
      }
    >
      <OPDVisitRegistrationContent />
    </Suspense>
  );
}