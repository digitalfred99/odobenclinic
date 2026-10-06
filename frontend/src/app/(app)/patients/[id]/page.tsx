"use client";

import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, isValid, parseISO } from "date-fns";
import {
  ArrowLeft,
  Building2,
  Cake,
  CalendarDays,
  CalendarPlus,
  CreditCard,
  IdCard,
  MapPin,
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
import { Button } from "@/components/ui/button";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { apiRequest } from "@/lib/api";
import type { PatientFormValues } from "@/schemas/patient";
import type { Patient } from "@/types/patient";

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

export default function PatientDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const patientId = params?.id ?? "";
  const { data: patient, isLoading, error, refetch } = useQuery({
    queryKey: ["patient", patientId],
    queryFn: async () => apiRequest<Patient>(`/patients/${encodeURIComponent(patientId)}`),
    enabled: Boolean(patientId),
  });

  const displayValue = (value?: string | number | null) => value ?? "Not provided";
  const valueClassName = "mt-1.5 text-sm font-medium text-foreground";

  const handleSave = async (values: PatientFormValues) => {
    setSaveNotice(null);
    setSaveError(null);

    try {
      await apiRequest(`/patients/${encodeURIComponent(patientId)}`, {
        method: "PATCH",
        body: JSON.stringify(values),
      });
      await refetch();
      setIsEditing(false);
      setSaveNotice("Patient details updated successfully.");
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to update patient details.";
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
              {patient ? `${patient.firstName} ${patient.lastName}` : "Patient details"}
            </h2>
          </div>
        </div>
        {patient ? (
          <div className="flex flex-wrap gap-2">
            {!isEditing ? (
              <Button type="button" variant="secondary" onClick={() => { setSaveNotice(null); setIsEditing(true); }}>
                <Pencil className="mr-2 h-4 w-4" />Edit patient
              </Button>
            ) : null}
            <Button type="button" onClick={() => router.push(`/opd-visits?patientId=${encodeURIComponent(patientId)}`)}>
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
              lastName: patient.lastName,
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
            }}
            onSubmit={handleSave}
            submitLabel="Save changes"
          />
          <div className="flex justify-end">
            <Button type="button" variant="secondary" onClick={() => { setIsEditing(false); setSaveError(null); }}>
              Cancel editing
            </Button>
          </div>
        </div>
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
                <h3 className="mt-1 text-xl font-semibold text-foreground">{patient.firstName} {patient.lastName}</h3>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                  <IdCard className="h-4 w-4 text-primary" aria-hidden="true" />
                  Patient ID / OPD No. {displayValue(patient.patientId)}
                </p>
              </div>
            </div>

            <div className="space-y-6 pt-5">
              <section aria-labelledby="patient-personal-details">
                <h4 id="patient-personal-details" className="font-semibold text-foreground">Personal details</h4>
                <dl className="mt-4 grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
                  <div><PatientDetailLabel icon={CalendarDays}>Date of birth</PatientDetailLabel><dd className={valueClassName}>{displayValue(patient.dateOfBirth)}</dd></div>
                  <div><PatientDetailLabel icon={Cake}>Age</PatientDetailLabel><dd className={valueClassName}>{displayValue(patient.age)}</dd></div>
                  <div><PatientDetailLabel icon={UserRound}>Gender</PatientDetailLabel><dd className={`${valueClassName} capitalize`}>{displayValue(patient.gender)}</dd></div>
                  <div><PatientDetailLabel icon={UsersRound}>Marital status</PatientDetailLabel><dd className={`${valueClassName} capitalize`}>{displayValue(patient.maritalStatus)}</dd></div>
                  {patient.ghCardNumber ? <div><PatientDetailLabel icon={CreditCard}>Ghana Card number</PatientDetailLabel><dd className={valueClassName}>{patient.ghCardNumber}</dd></div> : null}
                  {patient.nhisNumber ? <div><PatientDetailLabel icon={ShieldCheck}>NHIS number</PatientDetailLabel><dd className={valueClassName}>{patient.nhisNumber}</dd></div> : null}
                </dl>
              </section>

              <section aria-labelledby="patient-contact-location" className="border-t border-border pt-5">
                <h4 id="patient-contact-location" className="font-semibold text-foreground">Contact &amp; location</h4>
                <dl className="mt-4 grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
                  <div><PatientDetailLabel icon={Phone}>Phone</PatientDetailLabel><dd className={valueClassName}>{displayValue(patient.phone)}</dd></div>
                  <div><PatientDetailLabel icon={MapPin}>Region</PatientDetailLabel><dd className={valueClassName}>{displayValue(patient.region)}</dd></div>
                  <div><PatientDetailLabel icon={Building2}>District</PatientDetailLabel><dd className={valueClassName}>{displayValue(patient.district)}</dd></div>
                  <div><PatientDetailLabel icon={MapPin}>Town</PatientDetailLabel><dd className={valueClassName}>{displayValue(patient.town)}</dd></div>
                  <div><PatientDetailLabel icon={MapPin}>Area</PatientDetailLabel><dd className={valueClassName}>{displayValue(patient.area)}</dd></div>
                  {formatTimestamp(patient.createdAt) ? (
                    <div>
                      <PatientDetailLabel icon={CalendarPlus}>Record created</PatientDetailLabel>
                      <dd className={valueClassName}>{formatTimestamp(patient.createdAt)}</dd>
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
        </div>
      ) : null}
    </div>
  );
}
