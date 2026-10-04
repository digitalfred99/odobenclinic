"use client";

import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type { Patient } from "@/types/patient";
import type { OPDVisit } from "@/types/opd";

type PatientsLookupResponse = {
  patients: Patient[];
  pagination?: {
    total?: number;
    page?: number;
    limit?: number;
    totalPages?: number;
  };
};

export default function OPDVisitsPage() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [remarks, setRemarks] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const patientId = new URLSearchParams(window.location.search).get("patientId");
    if (patientId) {
      setSelectedPatientId(patientId);
    }
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["opd-patients", searchTerm],
    queryFn: async () => {
      const queryString = searchTerm.trim() ? `?search=${encodeURIComponent(searchTerm.trim())}&limit=8` : "?limit=8";
      return apiRequest<PatientsLookupResponse>(`/patients${queryString}`);
    },
    enabled: searchTerm.trim().length >= 0,
  });

  const { data: selectedPatientData, isLoading: isSelectedPatientLoading, isError: isSelectedPatientError } = useQuery({
    queryKey: ["opd-selected-patient", selectedPatientId],
    queryFn: async () => apiRequest<Patient>(`/patients/${encodeURIComponent(selectedPatientId)}`),
    enabled: Boolean(selectedPatientId),
  });

  const patients = useMemo(() => data?.patients ?? [], [data?.patients]);

  const selectedPatient = useMemo(
    () => patients.find((patient) => patient.id === selectedPatientId) ?? selectedPatientData ?? null,
    [patients, selectedPatientData, selectedPatientId]
  );

  const handleSelectPatient = (patient: Patient) => {
    setSelectedPatientId(patient.id);
    setSearchTerm("");
    setError(null);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice(null);
    setError(null);

    if (!selectedPatientId) {
      setError("Choose a patient before registering the visit.");
      return;
    }

    try {
      const response = await apiRequest<OPDVisit>("/opd-visits", {
        method: "POST",
        body: JSON.stringify({
          patient: selectedPatientId,
          date: date || undefined,
          remarks: remarks.trim() || undefined,
        }),
      });

      const displayPatientId = response.patient?.patientId ?? "patient record";
      const displayName = response.patient ? `${response.patient.firstName} ${response.patient.lastName}`.trim() : "Patient";

      setNotice(`Visit registered for ${displayName}. OPD No.: ${displayPatientId} (${response.newReturning ?? "new"})`);
      setSelectedPatientId("");
      setRemarks("");
      setDate(new Date().toISOString().slice(0, 10));
      setSearchTerm("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to register OPD visit.";
      setError(message);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">OPD visits</p>
          <h2 className="mt-2 text-3xl font-semibold text-foreground">Register patient attendance</h2>
        </div>
        <Button type="button" variant="secondary" onClick={() => router.push("/opd-visits/list")}>View visit list</Button>
      </div>

      {notice ? <FeedbackMessage message={notice} kind="success" onDismiss={() => setNotice(null)} /> : null}
      {error ? <FeedbackMessage message={error} kind="error" onDismiss={() => setError(null)} /> : null}

      <div className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
        <section className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="pl-9"
                placeholder="Search patient by name, patient ID, phone, or area"
              />
            </div>
          </div>

          <div className="space-y-3">
            {isLoading ? (
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

            {!isLoading && searchTerm.trim() && patients.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">
                No matching patient records found.
              </div>
            ) : null}

            {patients.map((patient) => (
              <button
                key={patient.id}
                type="button"
                onClick={() => handleSelectPatient(patient)}
                className="flex w-full flex-col gap-2 rounded-xl border border-border bg-background p-4 text-left transition hover:border-primary/60 hover:bg-secondary/30"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-foreground">{patient.firstName} {patient.lastName}</p>
                    <p className="text-sm text-muted-foreground">{patient.patientId ?? "Patient ID unavailable"}</p>
                  </div>
                  <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-primary">Select</span>
                </div>
                <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                  <span>{patient.phone ?? "No phone"}</span>
                  <span>{patient.area ?? "No area"}</span>
                </div>
              </button>
            ))}
          </div>
        </section>

        <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="space-y-2">
            <label htmlFor="selected-patient" className="text-sm font-medium text-foreground">Selected patient</label>
            <div id="selected-patient" className="min-h-10 rounded-xl border border-border bg-background px-3 py-2 text-sm text-muted-foreground">
              {selectedPatient
                ? `${selectedPatient.firstName} ${selectedPatient.lastName} • ${selectedPatient.patientId ?? "No clinic ID"}`
                : selectedPatientId
                  ? isSelectedPatientLoading
                    ? <span role="status" aria-label="Loading selected patient" aria-busy="true" className="block py-1"><Skeleton className="h-4 w-52 max-w-full" /></span>
                    : isSelectedPatientError
                      ? "Unable to load the selected patient."
                      : "No patient selected yet."
                  : "No patient selected yet."}
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="visit-date" className="text-sm font-medium text-foreground">Visit date</label>
            <Input id="visit-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </div>

          <div className="space-y-2">
            <label htmlFor="visit-remarks" className="text-sm font-medium text-foreground">Remarks</label>
            <textarea
              id="visit-remarks"
              value={remarks}
              onChange={(event) => setRemarks(event.target.value)}
              rows={5}
              className="flex w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              placeholder="Optional notes for this attendance"
            />
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => {
              setSelectedPatientId("");
              setDate(new Date().toISOString().slice(0, 10));
              setRemarks("");
              setError(null);
              setNotice(null);
            }}>
              Reset
            </Button>
            <Button type="submit" disabled={!selectedPatientId}>Register visit</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
