"use client";

import { Suspense, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog } from "@base-ui/react/dialog";
import { Archive, CircleAlert, UserPlus, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { ApiError, apiRequest } from "@/lib/api";
import { PatientForm } from "@/components/features/patients/patient-form";
import { PatientSearchList } from "@/components/features/patients/patient-search";
import { Button } from "@/components/ui/button";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { prependPatientToList } from "@/lib/patients";
import { cachePatientLocation } from "@/lib/patient-location-cache";
import type { PatientFormValues } from "@/schemas/patient";
import type { Patient, PatientListResponse } from "@/types/patient";

type RegistrationMode = "new" | "clinic-record" | null;

type PatientWithOpdResponse = {
  patient: Patient;
};

type DuplicateReview = {
  patientId: string | null;
  values: PatientFormValues;
  canAccept: boolean;
};

function comparisonValue(value: string | number | null | undefined): string {
  if (value === undefined || value === null || value === "") return "—";
  return String(value);
}

function PatientsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [registrationMode, setRegistrationMode] = useState<RegistrationMode>(() => {
    const requestedMode = searchParams.get("register");
    return requestedMode === "new" || requestedMode === "clinic-record" ? requestedMode : null;
  });
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [duplicateReview, setDuplicateReview] = useState<DuplicateReview | null>(null);
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [comparisonPatient, setComparisonPatient] = useState<Patient | null>(null);
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const [comparisonError, setComparisonError] = useState<string | null>(null);
  const [confirmedDuplicatePatientId, setConfirmedDuplicatePatientId] = useState<string | null>(null);
  const [reviewNotice, setReviewNotice] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const closeRegistration = () => {
    setRegistrationMode(null);
    setDuplicateReview(null);
    setComparisonOpen(false);
    setComparisonPatient(null);
    setComparisonError(null);
    setConfirmedDuplicatePatientId(null);
    setReviewNotice(null);
    if (searchParams.has("register")) router.replace("/patients", { scroll: false });
  };

  const openComparison = async () => {
    if (!duplicateReview?.patientId) {
      setComparisonError("Could not find the existing patient ID.");
      setComparisonOpen(true);
      return;
    }

    setComparisonOpen(true);
    setComparisonLoading(true);
    setComparisonError(null);
    try {
      let page = 1;
      let totalPages = 1;
      let patient: Patient | undefined;

      do {
        const query = new URLSearchParams({
          patientId: duplicateReview.patientId,
          limit: "100",
          page: String(page),
        });
        const response = await apiRequest<PatientListResponse>(`/patients?${query.toString()}`);
        patient = response.patients.find((match) => match.patientId === duplicateReview.patientId);
        totalPages = response.pagination?.totalPages ?? page;
        page += 1;
      } while (!patient && page <= totalPages);

      if (!patient) {
        setComparisonError("Patient record not found. Close this window and search by OPD No.");
      } else {
        setComparisonPatient(patient);
      }
    } catch (err) {
      setComparisonError(err instanceof Error ? err.message : "Could not load patient details.");
    } finally {
      setComparisonLoading(false);
    }
  };

  const comparisonRows = duplicateReview
    ? [
        ["First name", duplicateReview.values.firstName, comparisonPatient?.firstName],
        ["Last name", duplicateReview.values.lastName, comparisonPatient?.lastName],
        ["Patient ID", "Will be assigned after saving", comparisonPatient?.patientId],
        ["Date of birth", duplicateReview.values.dateOfBirth, comparisonPatient?.dateOfBirth],
        ["Age", duplicateReview.values.age, comparisonPatient?.age],
        ["Gender", duplicateReview.values.gender, comparisonPatient?.gender],
        ["Phone", duplicateReview.values.phone, comparisonPatient?.phone],
        ["Marital status", duplicateReview.values.maritalStatus, comparisonPatient?.maritalStatus],
        ["Ghana Card", duplicateReview.values.ghCardNumber, comparisonPatient?.ghCardNumber],
        ["NHIS number", duplicateReview.values.nhisNumber, comparisonPatient?.nhisNumber],
        ["Region", duplicateReview.values.region, comparisonPatient?.region],
        ["District", duplicateReview.values.district, comparisonPatient?.district],
        ["Town", duplicateReview.values.town, comparisonPatient?.town],
        ["Area", duplicateReview.values.area, comparisonPatient?.area],
      ] as const
    : [];

  const handleSubmit = async (values: PatientFormValues, photo: File | null) => {
    setNotice(null);
    setError(null);
    setDuplicateReview(null);
    setComparisonOpen(false);
    setComparisonPatient(null);
    setComparisonError(null);
    setReviewNotice(null);
    setPhotoError(null);

    try {
      const confirmedPatientId = confirmedDuplicatePatientId;
      let patient: Patient;
      let firstVisitRecorded = false;

      if (registrationMode === "new") {
        let registrationBody: BodyInit;
        const patientData = {
          ...values,
          ...(confirmedPatientId ? { confirmedDuplicatePatientId: confirmedPatientId } : {}),
        };

        if (photo) {
          const formData = new FormData();
          formData.append("patient", JSON.stringify(patientData));
          formData.append("image", photo);
          registrationBody = formData;
        } else {
          registrationBody = JSON.stringify({ patient: patientData });
        }

        const result = await apiRequest<PatientWithOpdResponse>("/patients/with-opd", {
          method: "POST",
          body: registrationBody,
        });
        patient = result.patient;
        firstVisitRecorded = true;
      } else {
        let body: BodyInit;
        if (photo) {
          const formData = new FormData();
          Object.entries(values).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== "") {
              formData.append(key, String(value));
            }
          });
          if (confirmedPatientId) {
            formData.append("confirmedDuplicatePatientId", confirmedPatientId);
          }
          formData.append("image", photo);
          body = formData;
        } else {
          body = JSON.stringify({
            ...values,
            ...(confirmedPatientId ? { confirmedDuplicatePatientId: confirmedPatientId } : {}),
          });
        }

        patient = await apiRequest<Patient>("/patients", {
          method: "POST",
          body,
        });
      }

      cachePatientLocation(patient);
      queryClient.setQueryData<PatientListResponse>(
        ["patients", ""],
        (current) => prependPatientToList(current, patient)
      );
      void queryClient.invalidateQueries({ queryKey: ["patients"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard-overview"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard-new-patients"] });
      if (firstVisitRecorded) void queryClient.invalidateQueries({ queryKey: ["dashboard-weekly-opd"] });
      setNotice(
        registrationMode === "clinic-record"
          ? `Patient added from clinic records${patient.patientId ? `: ${patient.patientId}` : ""}. No OPD visit was created.`
          : `Patient registered${patient.patientId ? `: ${patient.patientId}` : ""}. First OPD visit recorded.`
      );
      closeRegistration();
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to create patient.";
      if (err instanceof ApiError && err.status === 409) {
        setDuplicateReview({
          patientId: message.match(/\bPT-\d+\/\d{4}\b/i)?.[0] ?? null,
          values,
          canAccept: err.key === "patient_exists",
        });
        setConfirmedDuplicatePatientId(null);
        setError(null);
        return false;
      }
      if (err instanceof ApiError && err.status === 413) {
        setPhotoError("Photo is too large, please retake.");
        return false;
      }
      if (
        err instanceof ApiError &&
        err.status === 400 &&
        photo &&
        (err.key?.toLowerCase() === "image" || /image|photo/i.test(message))
      ) {
        setPhotoError(message);
        return false;
      }
      setError(message);
      return false;
    }
  };

  const handlePhotoChange = () => setPhotoError(null);
  const openRegistration = (mode: Exclude<RegistrationMode, null>) => {
    setNotice(null);
    setError(null);
    setDuplicateReview(null);
    setComparisonOpen(false);
    setComparisonPatient(null);
    setComparisonError(null);
    setConfirmedDuplicatePatientId(null);
    setReviewNotice(null);
    setPhotoError(null);
    setRegistrationMode(mode);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Patients</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">Patient records</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Search first to find an existing record, then choose the right next step.
          </p>
        </div>
        <div className="grid gap-2 sm:flex sm:flex-wrap sm:justify-end">
          <Button
            type="button"
            className="min-h-11"
            onClick={() => openRegistration("new")}
          >
            <UserPlus className="mr-2 h-4 w-4" aria-hidden="true" />
            Register new patient
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-11 border-info/40 bg-info/10 text-info hover:bg-info/15"
            onClick={() => openRegistration("clinic-record")}
          >
            <Archive className="mr-2 h-4 w-4" aria-hidden="true" />
            Add from clinic records
          </Button>
        </div>
      </div>

      {notice ? <FeedbackMessage message={notice} kind="success" onDismiss={() => setNotice(null)} /> : null}
      {error ? <FeedbackMessage message={error} kind="error" onDismiss={() => setError(null)} /> : null}
      <PatientSearchList />

      <Dialog.Root
        open={registrationMode !== null}
        onOpenChange={(open) => {
          if (!open) closeRegistration();
        }}
      >
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-[80] bg-foreground/40 backdrop-blur-sm transition-opacity data-[starting-style]:opacity-0 data-[ending-style]:opacity-0" />
          <Dialog.Popup className="fixed inset-x-0 bottom-0 top-2 z-[81] flex flex-col overflow-hidden rounded-t-3xl border border-border bg-card text-card-foreground shadow-2xl outline-none transition-transform duration-200 data-[starting-style]:translate-y-4 data-[ending-style]:translate-y-4 sm:max-h-[90dvh] sm:rounded-2xl lg:inset-y-0 lg:right-0 lg:left-auto lg:top-0 lg:h-dvh lg:max-h-none lg:w-[min(48rem,52vw)] lg:max-w-none lg:translate-x-0 lg:translate-y-0 lg:rounded-r-none lg:rounded-l-2xl">
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-5 py-4 sm:px-7">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                  {registrationMode === "clinic-record" ? "Patient archive" : "New registration"}
                </p>
                <Dialog.Title className="mt-1 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                  {registrationMode === "clinic-record" ? "Add from clinic records" : "Register new patient"}
                </Dialog.Title>
                <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                  {registrationMode === "clinic-record"
                    ? "Add a patient already recorded in your clinic books. This does not create an OPD visit."
                    : "Create a permanent patient record and record their first OPD visit."}
                </Dialog.Description>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Close patient registration"
                className="shrink-0"
                onClick={closeRegistration}
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-7 sm:py-6">
              {reviewNotice ? (
                <p className="mb-5 rounded-lg border border-info/40 bg-info/10 px-4 py-3 text-sm text-foreground" role="status">
                  {reviewNotice}
                </p>
              ) : null}
              {error ? <div className="mb-5"><FeedbackMessage message={error} kind="error" onDismiss={() => setError(null)} /></div> : null}
              {registrationMode ? (
                <PatientForm
                  key={registrationMode}
                  className="border-0 bg-transparent p-0 shadow-none"
                  onSubmit={handleSubmit}
                  submitLabel={registrationMode === "clinic-record" ? "Add patient record" : "Register patient"}
                  clearOnSuccess
                  enablePhoto
                  photoError={photoError}
                  onPhotoChange={handlePhotoChange}
                />
              ) : null}
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root
        open={duplicateReview !== null}
        onOpenChange={(open) => {
          if (!open) setDuplicateReview(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-[90] bg-foreground/50 backdrop-blur-sm data-[starting-style]:opacity-0 data-[ending-style]:opacity-0" />
          <Dialog.Popup className="fixed left-1/2 top-1/2 z-[91] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-2xl outline-none sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden="true" />
                <div>
                  <Dialog.Title className="text-lg font-semibold text-foreground">Possible duplicate</Dialog.Title>
                  <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                    Check the existing record before you continue.
                  </Dialog.Description>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Close duplicate notice"
                onClick={() => setDuplicateReview(null)}
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </Button>
            </div>
            {duplicateReview?.patientId ? (
              <p className="mt-4 rounded-lg bg-background px-3 py-2 font-mono text-sm font-semibold text-foreground">
                OPD No. {duplicateReview.patientId}
              </p>
            ) : (
              <p className="mt-4 text-sm text-destructive">The matching patient number could not be read. Search patient records before continuing.</p>
            )}
            {duplicateReview && !duplicateReview.canAccept ? (
              <p className="mt-3 text-sm text-destructive">
                This Ghana Card or NHIS number is already in use and cannot be reused.
              </p>
            ) : null}
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setDuplicateReview(null)}>
                Back to form
              </Button>
              <Button
                type="button"
                disabled={!duplicateReview?.patientId}
                onClick={() => void openComparison()}
              >
                Compare persons
              </Button>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root
        open={comparisonOpen}
        onOpenChange={(open) => setComparisonOpen(open)}
      >
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-[100] bg-foreground/60 backdrop-blur-sm data-[starting-style]:opacity-0 data-[ending-style]:opacity-0" />
          <Dialog.Popup className="fixed left-1/2 top-1/2 z-[101] flex max-h-[90dvh] w-[calc(100%-1.5rem)] max-w-4xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-2xl outline-none sm:w-[calc(100%-3rem)]">
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-5 py-4 sm:px-6">
              <div>
                <Dialog.Title className="text-lg font-semibold text-foreground">Compare persons</Dialog.Title>
                <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                  Compare the new details with the existing patient record.
                </Dialog.Description>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Close comparison"
                onClick={() => setComparisonOpen(false)}
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </Button>
            </div>
            <div className="min-h-0 overflow-y-auto p-4 sm:p-6">
              {comparisonLoading ? (
                <p className="py-8 text-center text-sm text-muted-foreground" role="status">Loading patient details…</p>
              ) : null}
              {comparisonError ? (
                <p className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive" role="alert">
                  {comparisonError}
                </p>
              ) : null}
              {duplicateReview && !duplicateReview.canAccept ? (
                <p className="mb-4 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive" role="alert">
                  This Ghana Card or NHIS number is already in use. It cannot be accepted for a new patient.
                </p>
              ) : null}
              {comparisonPatient && duplicateReview ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  {[
                    {
                      title: "New details",
                      subtitle: "Not yet registered",
                      values: comparisonRows.map(([label, current]) => [label, comparisonValue(current)] as const),
                    },
                    {
                      title: "Existing record",
                      subtitle: comparisonPatient.patientId ?? "Patient",
                      values: comparisonRows.map(([label, , existing]) => [label, comparisonValue(existing)] as const),
                    },
                  ].map((column) => (
                    <section key={column.title} className="rounded-xl border border-border bg-background p-4" aria-label={column.title}>
                      <h3 className="font-semibold text-foreground">{column.title}</h3>
                      <p className="mt-1 text-xs text-muted-foreground">{column.subtitle}</p>
                      <dl className="mt-4 space-y-3">
                        {column.values.map(([label, value]) => (
                          <div key={label} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-2 border-t border-border pt-2 first:border-0 first:pt-0">
                            <dt className="text-xs text-muted-foreground">{label}</dt>
                            <dd className="break-words text-right text-sm font-medium text-foreground">{value}</dd>
                          </div>
                        ))}
                      </dl>
                    </section>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-border px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
              <Button
                type="button"
                variant="outline"
                disabled={comparisonLoading || !comparisonPatient}
                onClick={() => {
                  setComparisonOpen(false);
                  setDuplicateReview(null);
                  setNotice("No new patient was added.");
                  closeRegistration();
                }}
              >
                Ignore new record
              </Button>
              <Button
                type="button"
                disabled={!comparisonPatient || comparisonLoading || !duplicateReview?.patientId || !duplicateReview.canAccept}
                onClick={() => {
                  if (!duplicateReview?.patientId) return;
                  setConfirmedDuplicatePatientId(duplicateReview.patientId);
                  setComparisonOpen(false);
                  setDuplicateReview(null);
                  setReviewNotice("Review complete. Submit the form again to register this person.");
                }}
              >
                Accept new record
              </Button>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

export default function PatientsPage() {
  return (
    <Suspense fallback={<div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">Preparing patient records…</div>}>
      <PatientsPageContent />
    </Suspense>
  );
}
