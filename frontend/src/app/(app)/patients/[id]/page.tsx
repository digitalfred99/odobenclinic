"use client";

import { useState, type ReactNode } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { useQuery } from "@tanstack/react-query";
import { format, isValid, parseISO } from "date-fns";
import {
  ArrowUpRight,
  ArrowLeft,
  Building2,
  BriefcaseBusiness,
  Cake,
  CalendarDays,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  CreditCard,
  IdCard,
  MapPin,
  Mail,
  Phone,
  Pencil,
  ShieldCheck,
  UserCheck,
  UserRound,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { PatientForm } from "@/components/features/patients/patient-form";
import { PatientAvatar } from "@/components/features/opd/patient-avatar";
import { PatientPhotoImage } from "@/components/features/patients/patient-photo-image";
import { Button } from "@/components/ui/button";
import { CloseButton } from "@/components/ui/close-button";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { ApiError, apiRequest } from "@/lib/api";
import { formatPatientName } from "@/lib/patient-name";
import { formatPatientDisplayId } from "@/lib/reporting";
import { Skeleton } from "@/components/ui/skeleton";
import { resolvePatientPhotoUrl } from "@/lib/patient-photo";
import { buildPatientUpdateBody } from "@/lib/patients";
import { mapPatientValidationErrorToFields } from "@/lib/patient-validation";
import type { PatientFormValues } from "@/schemas/patient";
import { patientReligionLabel, type Patient, type PatientUpdateInput } from "@/types/patient";
import type { OPDVisitListResponse } from "@/types/opd";

const VISITS_PER_PAGE = 20;

function PatientDetailLabel({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <dt className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
      {children}
    </dt>
  );
}

function formatTimestamp(value?: string) {
  if (!value) return null;
  const date = parseISO(value);
  return isValid(date) ? format(date, "d MMM yyyy, h:mm a") : value;
}

function formatVisitDate(value?: string) {
  if (!value) return "Date not recorded";
  const date = parseISO(value);
  return isValid(date) ? format(date, "EEEE, d MMMM yyyy") : value;
}

export default function PatientDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [serverFieldErrors, setServerFieldErrors] = useState<Partial<Record<keyof PatientFormValues, string>>>({});
  const [visitsPage, setVisitsPage] = useState(1);
  const patientId = params?.id ?? "";
  const { data: patient, isLoading, error, refetch } = useQuery({
    queryKey: ["patient", patientId],
    queryFn: ({ signal }) => apiRequest<Patient>(`/patients/${encodeURIComponent(patientId)}`, { signal }),
    enabled: Boolean(patientId),
  });
  const visitsQuery = new URLSearchParams({
    patientId,
    page: String(visitsPage),
    limit: String(VISITS_PER_PAGE),
  }).toString();
  const {
    data: visitHistory,
    isLoading: isVisitsLoading,
    isError: isVisitsError,
    refetch: refetchVisits,
  } = useQuery({
    queryKey: ["patient-visits", patientId, visitsPage],
    queryFn: ({ signal }) => apiRequest<OPDVisitListResponse>(`/opd-visits?${visitsQuery}`, { signal }),
    enabled: Boolean(patient && !isEditing),
  });

  const displayValue = (value?: string | number | null) => value ?? "Not provided";
  const valueClassName = "mt-1.5 text-sm font-medium text-foreground";
  const lastVisitDate = visitsPage === 1
    ? visitHistory?.opdVisits.reduce((latest, visit) => visit.date > latest ? visit.date : latest, "")
    : "";

  const handleSave = async (values: PatientFormValues, photo: File | null) => {
    setSaveNotice(null);
    setSaveError(null);
    setServerFieldErrors({});

    const update: PatientUpdateInput = {
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim(),
      otherName: values.otherName?.trim() || null,
      email: values.email?.trim() || null,
      postalAddress: values.postalAddress || null,
      occupation: values.occupation || null,
      dateOfBirth: values.dateOfBirth || null,
      age: values.age === undefined || values.age === "" ? null : Number(values.age),
      phone: values.phone?.trim() || null,
      ghCardNumber: values.ghCardNumber?.trim() || null,
      nhisNumber: values.nhisNumber?.trim() || null,
      region: values.region?.trim() || null,
      district: values.district?.trim() || null,
      town: values.town?.trim() || null,
      area: values.area?.trim() || null,
      gender: values.gender === "" || values.gender === undefined ? undefined : values.gender,
      maritalStatus: values.maritalStatus === "" || values.maritalStatus === undefined
        ? undefined
        : values.maritalStatus,
      religion: values.religion === "" || values.religion === undefined
        ? undefined
        : values.religion,
    };

    const clearsExistingValue = (next: string | number | null | undefined, current: string | number | null | undefined) =>
      next === null && current !== null && current !== undefined && String(current).trim() !== "";
    if (photo && (
      clearsExistingValue(update.otherName, patient?.otherName)
      || clearsExistingValue(update.email, patient?.email)
      || clearsExistingValue(update.postalAddress, patient?.postalAddress)
      || clearsExistingValue(update.occupation, patient?.occupation)
      || clearsExistingValue(update.dateOfBirth, patient?.dateOfBirth?.slice(0, 10))
      || clearsExistingValue(update.age, patient?.age)
      || clearsExistingValue(update.phone, patient?.phone)
      || clearsExistingValue(update.ghCardNumber, patient?.ghCardNumber)
      || clearsExistingValue(update.nhisNumber, patient?.nhisNumber)
      || clearsExistingValue(update.region, patient?.region)
      || clearsExistingValue(update.district, patient?.district)
      || clearsExistingValue(update.town, patient?.town)
      || clearsExistingValue(update.area, patient?.area)
    )) {
      setSaveError("Save cleared details without a new photo first. The photo upload request cannot clear empty fields.");
      return false;
    }

    try {
      await apiRequest(`/patients/${encodeURIComponent(patientId)}`, {
        method: "PATCH",
        body: buildPatientUpdateBody(update, photo),
      });
      await refetch();
      setIsEditing(false);
      setSaveNotice("Patient details updated successfully.");
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to update patient details.";
      if (err instanceof ApiError && err.status === 400) {
        setServerFieldErrors(mapPatientValidationErrorToFields(message));
      }
      setSaveError(message);
      return false;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Back to patient list"
            title="Back to patient list"
            onClick={() => router.push("/patients")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Patient record</p>
            <h2 className="mt-1 truncate text-2xl font-semibold text-foreground sm:text-3xl">
              {patient ? formatPatientName(patient) : "Patient details"}
            </h2>
          </div>
        </div>
        {patient ? (
          <div className="flex flex-wrap gap-2">
            {!isEditing ? (
              <Button type="button" variant="secondary" onClick={() => { setSaveNotice(null); setServerFieldErrors({}); setIsEditing(true); }}>
                <Pencil className="mr-2 h-4 w-4" />Edit patient
              </Button>
            ) : null}
            <Button type="button" onClick={() => router.push(`/opd-visits/register?patientId=${encodeURIComponent(patientId)}`)}>
              Register OPD visit
            </Button>
          </div>
        ) : null}
      </div>

      {isLoading ? (
        <section className="space-y-5 rounded-2xl border border-border bg-card p-6 shadow-sm" aria-label="Loading patient details" aria-busy="true">
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
      {error ? (
        <section className="rounded-2xl border border-destructive/40 bg-card p-6 shadow-sm" role="alert">
          <h3 className="font-semibold text-foreground">Unable to load this patient</h3>
          <p className="mt-1 text-sm text-muted-foreground">The patient record may have been removed, or there may be a connection problem.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => void refetch()}>Try again</Button>
            <Button type="button" variant="secondary" onClick={() => router.push("/patients")}>Back to patient list</Button>
          </div>
        </section>
      ) : null}
      {saveNotice ? <FeedbackMessage message={saveNotice} kind="success" onDismiss={() => setSaveNotice(null)} /> : null}
      {saveError ? <FeedbackMessage message={saveError} kind="error" onDismiss={() => setSaveError(null)} /> : null}

      {patient && isEditing ? (
        <div className="space-y-3">
          <PatientForm
            key={patient.id}
            initialValues={{
              firstName: patient.firstName,
              otherName: patient.otherName ?? "",
              lastName: patient.lastName,
              email: patient.email ?? "",
              postalAddress: patient.postalAddress ?? "",
              occupation: patient.occupation ?? "",
              dateOfBirth: patient.dateOfBirth?.slice(0, 10) ?? "",
              age: patient.age ?? "",
              phone: patient.phone ?? "",
              ghCardNumber: patient.ghCardNumber ?? "",
              nhisNumber: patient.nhisNumber ?? "",
              region: patient.region ?? "",
              district: patient.district ?? "",
              town: patient.town ?? "",
              area: patient.area ?? "",
              gender: patient.gender ?? "",
              maritalStatus: patient.maritalStatus ?? "",
              religion: patient.religion ?? "",
            }}
            existingPhotoUrl={patient.imageUrl}
            enablePhoto
            serverFieldErrors={serverFieldErrors}
            onFieldChange={(field) => setServerFieldErrors((current) => {
              if (!(field in current)) return current;
              const next = { ...current };
              delete next[field];
              return next;
            })}
            onSubmit={handleSave}
            submitLabel="Save changes"
          />
          <div className="flex justify-end">
            <Button type="button" variant="secondary" onClick={() => { setIsEditing(false); setSaveError(null); setServerFieldErrors({}); }}>
              Cancel editing
            </Button>
          </div>
        </div>
      ) : null}

      {patient?.imageUrl ? (
        <Dialog.Root open={photoOpen} modal onOpenChange={setPhotoOpen}>
          <Dialog.Portal>
            <Dialog.Backdrop className="pointer-events-auto touch-none fixed inset-0 z-[100] bg-foreground/50 backdrop-blur-sm" />
            <Dialog.Popup
              className="fixed left-1/2 top-1/2 z-[101] flex max-h-[calc(100dvh-1.5rem)] w-[calc(100%-1.5rem)] max-w-5xl -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl border border-border bg-card p-3 text-card-foreground shadow-xl outline-none sm:max-h-[calc(100dvh-3rem)] sm:w-[calc(100%-3rem)] sm:p-5"
            >
              <div className="mb-3 flex items-center justify-between gap-3 border-b border-border pb-3 sm:mb-4 sm:pb-4">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                    Patient photo
                  </p>
                  <Dialog.Title className="mt-1 truncate text-lg font-semibold leading-tight text-foreground sm:text-xl">
                    {formatPatientName(patient)}
                  </Dialog.Title>
                  {patient.patientId ? (
                    <p className="mt-1.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                      <IdCard className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                      OPD No. {formatPatientDisplayId(patient.patientId)}
                    </p>
                  ) : null}
                </div>
                <CloseButton aria-label="Close patient photo" onClick={() => setPhotoOpen(false)} />
              </div>
              <div className="patient-photo-frame relative h-[min(68dvh,42rem)] min-h-[12rem] w-full overflow-hidden rounded-xl border border-border/70 bg-muted/30 shadow-inner">
                <PatientPhotoImage
                  src={resolvePatientPhotoUrl(patient.imageUrl)}
                  alt={`Patient photo of ${formatPatientName(patient)}`}
                  fill
                  sizes="(max-width: 640px) 100vw, 80vw"
                  className="object-contain p-2 sm:p-4"
                />
              </div>
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      ) : null}

      {patient && !isEditing ? (
        <div className="space-y-5">
          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm print:shadow-none">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
              <div>
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <UserRound className="h-4 w-4 text-primary" aria-hidden="true" />
                  Patient
                </p>
                <h3 className="mt-1 text-xl font-semibold text-foreground">{formatPatientName(patient)}</h3>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                  <IdCard className="h-4 w-4 text-primary" aria-hidden="true" />
                  OPD No. {patient.patientId ? formatPatientDisplayId(patient.patientId) : "N/A"}
                </p>
              </div>
              {patient.imageUrl ? (
                <button
                  type="button"
                  aria-label={`View photo of ${formatPatientName(patient)}`}
                  onClick={() => setPhotoOpen(true)}
                  className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <PatientPhotoImage
                    src={resolvePatientPhotoUrl(patient.imageUrl)}
                    alt={`Patient photo of ${formatPatientName(patient)}`}
                    width={96}
                    height={96}
                    className="h-24 w-24 rounded-xl border border-border object-cover"
                  />
                </button>
              ) : (
                <PatientAvatar patient={patient} size="profile" showPhoto={false} />
              )}
            </div>

            <div className="space-y-6 pt-5">
              <section aria-labelledby="patient-personal-details">
                <h4 id="patient-personal-details" className="font-semibold text-foreground">Personal details</h4>
                <dl className="mt-4 grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
                  <div><PatientDetailLabel icon={UserRound}>First name</PatientDetailLabel><dd className={valueClassName}>{displayValue(patient.firstName)}</dd></div>
                  <div><PatientDetailLabel icon={UserRound}>Other name</PatientDetailLabel><dd className={valueClassName}>{displayValue(patient.otherName)}</dd></div>
                  <div><PatientDetailLabel icon={UserRound}>Last name</PatientDetailLabel><dd className={valueClassName}>{displayValue(patient.lastName)}</dd></div>
                  <div><PatientDetailLabel icon={CalendarDays}>Date of birth</PatientDetailLabel><dd className={valueClassName}>{displayValue(patient.dateOfBirth)}</dd></div>
                  <div><PatientDetailLabel icon={Cake}>Age</PatientDetailLabel><dd className={valueClassName}>{displayValue(patient.age)}</dd></div>
                  <div><PatientDetailLabel icon={UserRound}>Gender</PatientDetailLabel><dd className={`${valueClassName} capitalize`}>{displayValue(patient.gender)}</dd></div>
                  <div><PatientDetailLabel icon={UsersRound}>Marital status</PatientDetailLabel><dd className={`${valueClassName} capitalize`}>{displayValue(patient.maritalStatus)}</dd></div>
                  <div><PatientDetailLabel icon={UserRound}>Religion</PatientDetailLabel><dd className={valueClassName}>{patientReligionLabel(patient.religion) || "Not provided"}</dd></div>
                  {patient.occupation?.trim() ? <div><PatientDetailLabel icon={BriefcaseBusiness}>Occupation</PatientDetailLabel><dd className={valueClassName}>{patient.occupation}</dd></div> : null}
                  <div><PatientDetailLabel icon={CreditCard}>Ghana Card number</PatientDetailLabel><dd className={valueClassName}>{patient.ghCardNumber?.trim() || "N/A"}</dd></div>
                  <div><PatientDetailLabel icon={ShieldCheck}>NHIS number</PatientDetailLabel><dd className={valueClassName}>{patient.nhisNumber?.trim() || "N/A"}</dd></div>
                </dl>
              </section>

              <section aria-labelledby="patient-contact-location" className="border-t border-border pt-5">
                <h4 id="patient-contact-location" className="font-semibold text-foreground">Contact &amp; location</h4>
                <dl className="mt-4 grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
                  <div><PatientDetailLabel icon={Phone}>Phone</PatientDetailLabel><dd className={valueClassName}>{displayValue(patient.phone)}</dd></div>
                  {patient.email?.trim() ? <div><PatientDetailLabel icon={Mail}>Email</PatientDetailLabel><dd className={`${valueClassName} break-words`}>{patient.email}</dd></div> : null}
                  <div><PatientDetailLabel icon={MapPin}>Region</PatientDetailLabel><dd className={valueClassName}>{displayValue(patient.region)}</dd></div>
                  <div><PatientDetailLabel icon={Building2}>District</PatientDetailLabel><dd className={valueClassName}>{displayValue(patient.district)}</dd></div>
                  <div><PatientDetailLabel icon={MapPin}>Town</PatientDetailLabel><dd className={valueClassName}>{displayValue(patient.town)}</dd></div>
                  <div><PatientDetailLabel icon={MapPin}>Area</PatientDetailLabel><dd className={valueClassName}>{displayValue(patient.area)}</dd></div>
                  {patient.postalAddress?.trim() ? <div><PatientDetailLabel icon={MapPin}>Postal address</PatientDetailLabel><dd className={`${valueClassName} break-words`}>{patient.postalAddress}</dd></div> : null}
                </dl>
              </section>

              <section aria-labelledby="patient-record-history" className="border-t border-border pt-5">
                <h4 id="patient-record-history" className="font-semibold text-foreground">Record history</h4>
                <dl className="mt-4 grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
                  {formatTimestamp(patient.createdAt) ? (
                    <div>
                      <PatientDetailLabel icon={CalendarPlus}>Record created</PatientDetailLabel>
                      <dd className={valueClassName}>{formatTimestamp(patient.createdAt)}</dd>
                    </div>
                  ) : null}
                  {lastVisitDate ? (
                    <div>
                      <PatientDetailLabel icon={CalendarDays}>Last visit date</PatientDetailLabel>
                      <dd className={valueClassName}>{formatVisitDate(lastVisitDate)}</dd>
                    </div>
                  ) : null}
                  {patient.createdBy ? (
                    <div><PatientDetailLabel icon={UserCheck}>Registered by</PatientDetailLabel><dd className={valueClassName}>{patient.createdBy.firstName} {patient.createdBy.lastName}</dd></div>
                  ) : null}
                </dl>
              </section>
            </div>
          </section>
          <p className="text-xs text-muted-foreground print:hidden">
            This patient ID is permanent and is also the OPD No. used for every visit.
          </p>

          <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm" aria-labelledby="patient-visit-history">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4 sm:px-6">
              <div>
                <h3 id="patient-visit-history" className="flex items-center gap-2 text-lg font-semibold text-foreground">
                  <ClipboardList className="h-5 w-5 text-primary" aria-hidden="true" />
                  OPD visit history
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Every attendance and its remarks stay with this patient record.
                </p>
              </div>
              {typeof visitHistory?.pagination?.total === "number" ? (
                <span className="rounded-full bg-secondary px-3 py-1 text-sm font-medium text-secondary-foreground">
                  {visitHistory.pagination.total} {visitHistory.pagination.total === 1 ? "visit" : "visits"}
                </span>
              ) : null}
            </div>

            {isVisitsLoading ? (
              <div className="space-y-3 p-5" role="status" aria-label="Loading patient visit history" aria-busy="true">
                {[0, 1, 2].map((item) => (
                  <div key={item} className="rounded-xl border border-border p-4">
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="mt-3 h-4 w-full max-w-xl" />
                  </div>
                ))}
              </div>
            ) : null}

            {isVisitsError ? (
              <div className="p-5">
                <p className="text-sm text-destructive" role="alert">Unable to load this patient&apos;s visit history.</p>
                <Button type="button" className="mt-3" variant="outline" onClick={() => void refetchVisits()}>
                  Try again
                </Button>
              </div>
            ) : null}

            {!isVisitsLoading && !isVisitsError && (visitHistory?.opdVisits.length ?? 0) === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">No OPD visits recorded for this patient yet.</p>
            ) : null}

            {!isVisitsLoading && !isVisitsError && visitHistory?.opdVisits.length ? (
              <>
                <ol className="divide-y divide-border">
                  {visitHistory.opdVisits.map((visit) => (
                    <li key={visit.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-6">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-foreground">{formatVisitDate(visit.date)}</p>
                          {visit.newReturning ? (
                            <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium capitalize text-secondary-foreground">
                              {visit.newReturning}
                            </span>
                          ) : null}
                        </div>
                        {formatTimestamp(visit.createdAt) ? (
                          <p className="mt-1 text-xs text-muted-foreground">Recorded {formatTimestamp(visit.createdAt)}</p>
                        ) : null}
                        <p className="mt-3 flex items-start gap-2 text-sm leading-6 text-foreground">
                          <ClipboardList className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                          <span className="whitespace-pre-wrap">
                            {visit.remarks?.trim() || "No remarks recorded for this visit."}
                          </span>
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="min-h-10 shrink-0"
                        onClick={() => router.push(`/opd-visits/${encodeURIComponent(visit.id)}`)}
                      >
                        View visit <ArrowUpRight className="ml-2 h-4 w-4" aria-hidden="true" />
                      </Button>
                    </li>
                  ))}
                </ol>
                {(visitHistory.pagination?.totalPages ?? 1) > 1 ? (
                  <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-4 sm:px-6">
                    <p className="text-sm text-muted-foreground">
                      Page {visitHistory.pagination?.page ?? visitsPage} of {visitHistory.pagination?.totalPages}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        aria-label="Previous visit history page"
                        disabled={visitsPage <= 1 || isVisitsLoading}
                        onClick={() => setVisitsPage((page) => page - 1)}
                      >
                        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        aria-label="Next visit history page"
                        disabled={visitsPage >= (visitHistory.pagination?.totalPages ?? 1) || isVisitsLoading}
                        onClick={() => setVisitsPage((page) => page + 1)}
                      >
                        <ChevronRight className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}
          </section>
        </div>
      ) : null}
    </div>
  );
}
