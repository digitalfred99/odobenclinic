"use client";

import { Suspense, useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog } from "@base-ui/react/dialog";
import { Archive, CircleAlert, UserPlus } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { ApiError, apiRequest } from "@/lib/api";
import { toLocalInputDate } from "@/lib/dates";
import { PatientForm } from "@/components/features/patients/patient-form";
import { PatientSearchList } from "@/components/features/patients/patient-search";
import { Button } from "@/components/ui/button";
import { CloseButton } from "@/components/ui/close-button";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import {
  createClinicRecordPatient,
  createPatientWithOpd,
  prependPatientToList,
} from "@/lib/patients";
import { cachePatientLocation } from "@/lib/patient-location-cache";
import { mapPatientValidationErrorToFields } from "@/lib/patient-validation";
import { patientReligionLabel } from "@/types/patient";
import type { PatientFormValues } from "@/schemas/patient";
import type {
  ManualPatientCreateInput,
  Patient,
  PatientCreateInput,
  PatientListResponse,
} from "@/types/patient";

type RegistrationMode = "new" | "clinic-record" | null;
type RegistrationDraft = {
  values: Partial<PatientFormValues>;
  photo: File | null;
};

type DuplicateReview = {
  message: string;
  patientId: string | null;
  values: PatientFormValues;
  canAccept: boolean;
};

function toPatientCreateInput(
  values: PatientFormValues,
  confirmedDuplicatePatientId: string | null
): PatientCreateInput {
  if (!values.gender || !values.maritalStatus || !values.religion) {
    throw new Error("Enter the patient’s gender, marital status, and religion.");
  }

  return {
    firstName: values.firstName.trim(),
    lastName: values.lastName.trim(),
    gender: values.gender,
    maritalStatus: values.maritalStatus,
    religion: values.religion,
    ...(values.otherName?.trim() ? { otherName: values.otherName.trim() } : {}),
    ...(values.dateOfBirth ? { dateOfBirth: values.dateOfBirth } : {}),
    ...(values.age !== undefined && values.age !== "" ? { age: Number(values.age) } : {}),
    ...(values.phone ? { phone: values.phone } : {}),
    ...(values.email?.trim() ? { email: values.email.trim() } : {}),
    ...(values.postalAddress?.trim() ? { postalAddress: values.postalAddress } : {}),
    ...(values.occupation?.trim() ? { occupation: values.occupation } : {}),
    ...(values.ghCardNumber ? { ghCardNumber: values.ghCardNumber } : {}),
    ...(values.nhisNumber ? { nhisNumber: values.nhisNumber } : {}),
    ...(values.region ? { region: values.region } : {}),
    ...(values.district ? { district: values.district } : {}),
    ...(values.town ? { town: values.town } : {}),
    ...(values.area ? { area: values.area } : {}),
    ...(confirmedDuplicatePatientId ? { confirmedDuplicatePatientId } : {}),
  };
}

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
  const [registrationDrafts, setRegistrationDrafts] = useState<Partial<Record<Exclude<RegistrationMode, null>, RegistrationDraft>>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [duplicateReview, setDuplicateReview] = useState<DuplicateReview | null>(null);
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [comparisonPatient, setComparisonPatient] = useState<Patient | null>(null);
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const [comparisonError, setComparisonError] = useState<string | null>(null);
  const [confirmedDuplicatePatientId, setConfirmedDuplicatePatientId] = useState<string | null>(null);
  const [reviewNotice, setReviewNotice] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [manualNumberError, setManualNumberError] = useState<string | null>(null);
  const [serverFieldErrors, setServerFieldErrors] = useState<Partial<Record<keyof PatientFormValues, string>>>({});

  const updateRegistrationValues = useCallback((values: PatientFormValues) => {
    if (!registrationMode) return;
    setRegistrationDrafts((current) => ({
      ...current,
      [registrationMode]: {
        values,
        photo: current[registrationMode]?.photo ?? null,
      },
    }));
  }, [registrationMode]);

  const closeRegistration = (clearDraft = false) => {
    const closedMode = registrationMode;
    setRegistrationMode(null);
    setDuplicateReview(null);
    setComparisonOpen(false);
    setComparisonPatient(null);
    setComparisonError(null);
    setConfirmedDuplicatePatientId(null);
    setReviewNotice(null);
    setManualNumberError(null);
    setServerFieldErrors({});
    setValidationError(null);
    if (clearDraft && closedMode) {
      setRegistrationDrafts((current) => {
        const next = { ...current };
        delete next[closedMode];
        return next;
      });
    }
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
        ["Other name", duplicateReview.values.otherName, comparisonPatient?.otherName],
        ["Last name", duplicateReview.values.lastName, comparisonPatient?.lastName],
        ["Patient ID", "Will be assigned after saving", comparisonPatient?.patientId],
        ["Date of birth", duplicateReview.values.dateOfBirth, comparisonPatient?.dateOfBirth],
        ["Age", duplicateReview.values.age, comparisonPatient?.age],
        ["Gender", duplicateReview.values.gender, comparisonPatient?.gender],
        ["Marital status", duplicateReview.values.maritalStatus, comparisonPatient?.maritalStatus],
        ["Religion", patientReligionLabel(duplicateReview.values.religion), patientReligionLabel(comparisonPatient?.religion)],
        ["Phone", duplicateReview.values.phone, comparisonPatient?.phone],
        ["Email", duplicateReview.values.email, comparisonPatient?.email],
        ["Postal address", duplicateReview.values.postalAddress, comparisonPatient?.postalAddress],
        ["Occupation", duplicateReview.values.occupation, comparisonPatient?.occupation],
        ["Ghana Card", duplicateReview.values.ghCardNumber, comparisonPatient?.ghCardNumber],
        ["NHIS number", duplicateReview.values.nhisNumber, comparisonPatient?.nhisNumber],
        ["Region", duplicateReview.values.region, comparisonPatient?.region],
        ["District", duplicateReview.values.district, comparisonPatient?.district],
        ["Town", duplicateReview.values.town, comparisonPatient?.town],
        ["Area", duplicateReview.values.area, comparisonPatient?.area],
        ...(registrationMode === "new"
          ? [
              ["Visit date", duplicateReview.values.visitDate, undefined],
              ["Visit remarks", duplicateReview.values.visitRemarks, undefined],
            ] as const
          : []),
      ] as const
    : [];

  const handleSubmit = async (values: PatientFormValues, photo: File | null) => {
    setNotice(null);
    setError(null);
    setValidationError(null);
    setDuplicateReview(null);
    setComparisonOpen(false);
    setComparisonPatient(null);
    setComparisonError(null);
    setReviewNotice(null);
    setPhotoError(null);
    setManualNumberError(null);
    setServerFieldErrors({});

    try {
      const confirmedPatientId = confirmedDuplicatePatientId;
      let patient: Patient;
      let firstVisitRecorded = false;
      const patientInput = toPatientCreateInput(values, confirmedPatientId);

      if (registrationMode === "new") {
        const result = await createPatientWithOpd({
          patient: patientInput,
          opdVisit: {
            date: values.visitDate?.trim() || toLocalInputDate(),
            ...(values.visitRemarks?.trim() ? { remarks: values.visitRemarks.trim() } : {}),
          },
        }, photo);
        patient = result.patient;
        firstVisitRecorded = true;
      } else {
        if (values.year === undefined || values.year === "" || values.positionInYear === undefined || values.positionInYear === "") {
          setError("Enter the year and number in year from the clinic record.");
          return false;
        }

        const manualPatientInput: ManualPatientCreateInput = {
          ...patientInput,
          year: Number(values.year),
          positionInYear: Number(values.positionInYear),
        };
        patient = await createClinicRecordPatient(manualPatientInput, photo);
      }

      cachePatientLocation(patient);
      queryClient.setQueryData<PatientListResponse>(
        ["patients", "?page=1&limit=20"],
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
      closeRegistration(true);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to create patient.";
      if (err instanceof ApiError && err.status === 409 && err.key === "patient_exists") {
        setDuplicateReview({
          message,
          patientId: message.match(/\bPT-\d+\/\d{4}\b/i)?.[0] ?? null,
          values,
          canAccept: true,
        });
        setConfirmedDuplicatePatientId(null);
        setError(null);
        return false;
      }
      if (err instanceof ApiError && err.status === 409 && err.key === "patient_government_id_exists") {
        setError(message);
        return false;
      }
      if (err instanceof ApiError && err.status === 409 && err.key === "patient_id_exists") {
        const patientNumberMessage = "This patient number is already in use.";
        setManualNumberError(patientNumberMessage);
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
      if (err instanceof ApiError && err.status === 400) {
        setServerFieldErrors(mapPatientValidationErrorToFields(message));
        setValidationError(message);
        return false;
      }
      setError(message);
      return false;
    }
  };

  const handlePhotoChange = useCallback((photo?: File | null) => {
    setPhotoError(null);
    if (photo === undefined || !registrationMode) return;
    setRegistrationDrafts((current) => ({
      ...current,
      [registrationMode]: {
        values: current[registrationMode]?.values ?? {},
        photo,
      },
    }));
  }, [registrationMode]);
  const openRegistration = (mode: Exclude<RegistrationMode, null>) => {
    setNotice(null);
    setError(null);
    setValidationError(null);
    setDuplicateReview(null);
    setComparisonOpen(false);
    setComparisonPatient(null);
    setComparisonError(null);
    setConfirmedDuplicatePatientId(null);
    setReviewNotice(null);
    setPhotoError(null);
    setManualNumberError(null);
    setServerFieldErrors({});
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
      {error && !registrationMode ? <FeedbackMessage message={error} kind="error" onDismiss={() => setError(null)} /> : null}
      <PatientSearchList />

      <Dialog.Root
        open={registrationMode !== null}
        modal
        onOpenChange={(open) => {
          if (!open) closeRegistration();
        }}
      >
        <Dialog.Portal>
          <Dialog.Backdrop className="patient-registration-backdrop pointer-events-auto touch-none fixed inset-0 z-[80] bg-foreground/40 backdrop-blur-sm transition-opacity data-[starting-style]:opacity-0 data-[ending-style]:opacity-0" />
          <Dialog.Popup className="fixed inset-x-0 bottom-0 top-2 z-[81] flex flex-col overflow-hidden rounded-t-3xl border border-border bg-card text-card-foreground shadow-2xl outline-none transition-transform duration-200 data-[starting-style]:translate-y-4 data-[ending-style]:translate-y-4 sm:max-h-[90dvh] sm:rounded-2xl lg:inset-y-0 lg:right-0 lg:left-auto lg:top-0 lg:h-dvh lg:max-h-none lg:w-[min(48rem,52vw)] lg:max-w-none lg:translate-x-0 lg:translate-y-0 lg:rounded-r-none lg:rounded-l-2xl">
            <div className="sticky top-0 z-20 flex shrink-0 items-start justify-between gap-4 border-b border-border bg-card px-5 py-4 sm:px-7">
              <div className="min-w-0 flex-1 pr-1">
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
              <CloseButton
                type="button"
                aria-label="Close patient registration"
                onClick={() => closeRegistration()}
              />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-7 sm:py-6">
              {reviewNotice ? (
                <p className="mb-5 rounded-lg border border-info/40 bg-info/10 px-4 py-3 text-sm text-foreground" role="status">
                  {reviewNotice}
                </p>
              ) : null}
              {validationError || error ? (
                <div className="mb-5">
                  <FeedbackMessage
                    message={validationError ?? error ?? ""}
                    kind="error"
                    onDismiss={() => {
                      setValidationError(null);
                      setError(null);
                    }}
                  />
                </div>
              ) : null}
              {registrationMode ? (
                <PatientForm
                  key={registrationMode}
                  initialValues={registrationDrafts[registrationMode]?.values}
                  initialPhoto={registrationDrafts[registrationMode]?.photo}
                  className="border-0 bg-transparent p-0 shadow-none"
                  variant={registrationMode === "new" ? "with-opd" : "clinic-record"}
                  onSubmit={handleSubmit}
                  onValuesChange={updateRegistrationValues}
                  submitLabel={registrationMode === "clinic-record" ? "Add patient record" : "Register patient"}
                  enablePhoto
                  photoError={photoError}
                  manualNumberError={manualNumberError}
                  serverFieldErrors={serverFieldErrors}
                  onFieldChange={(field) => {
                    const relatedFields = field === "dateOfBirth" || field === "age"
                      ? ["dateOfBirth", "age"] as const
                      : [field];
                    setValidationError(null);
                    setServerFieldErrors((current) => {
                      const next = { ...current };
                      relatedFields.forEach((relatedField) => {
                        delete next[relatedField];
                      });
                      return next;
                    });
                    if (field === "year" || field === "positionInYear") {
                      setManualNumberError(null);
                      setError(null);
                    }
                  }}
                  onManualNumberChange={() => {
                    setManualNumberError(null);
                    setError(null);
                  }}
                  onPhotoChange={handlePhotoChange}
                />
              ) : null}
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root
        open={duplicateReview !== null}
        modal
        onOpenChange={(open) => {
          if (!open) setDuplicateReview(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Backdrop className="pointer-events-auto touch-none fixed inset-0 z-[90] bg-foreground/50 backdrop-blur-sm data-[starting-style]:opacity-0 data-[ending-style]:opacity-0" />
          <Dialog.Popup className="fixed left-1/2 top-1/2 z-[91] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-2xl outline-none sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden="true" />
                <div>
                  <Dialog.Title className="text-lg font-semibold text-foreground">Possible duplicate</Dialog.Title>
                  <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                    Check the existing record before you continue.
                  </Dialog.Description>
                  <p className="mt-2 text-sm text-foreground" role="alert">{duplicateReview?.message}</p>
                </div>
              </div>
              <CloseButton
                type="button"
                aria-label="Close duplicate notice"
                onClick={() => setDuplicateReview(null)}
              />
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
        modal
        onOpenChange={(open) => setComparisonOpen(open)}
      >
        <Dialog.Portal>
          <Dialog.Backdrop className="pointer-events-auto touch-none fixed inset-0 z-[100] bg-foreground/60 backdrop-blur-sm data-[starting-style]:opacity-0 data-[ending-style]:opacity-0" />
          <Dialog.Popup className="fixed left-1/2 top-1/2 z-[101] flex max-h-[90dvh] w-[calc(100%-1.5rem)] max-w-4xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-2xl outline-none sm:w-[calc(100%-3rem)]">
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-5 py-4 sm:px-6">
              <div>
                <Dialog.Title className="text-lg font-semibold text-foreground">Compare persons</Dialog.Title>
                <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                  Compare the new details with the existing patient record.
                </Dialog.Description>
              </div>
              <CloseButton
                type="button"
                aria-label="Close comparison"
                onClick={() => setComparisonOpen(false)}
              />
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
