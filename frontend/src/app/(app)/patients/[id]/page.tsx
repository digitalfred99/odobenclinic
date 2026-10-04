"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Pencil } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { PatientForm } from "@/components/features/patients/patient-form";
import { Button } from "@/components/ui/button";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { apiRequest } from "@/lib/api";
import type { PatientFormValues } from "@/schemas/patient";
import type { Patient } from "@/types/patient";

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
  const labelClassName = "text-xs font-semibold uppercase text-primary";
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

      {isLoading ? <p className="text-sm text-muted-foreground">Loading patient record...</p> : null}
      {error ? <p role="alert" className="text-sm text-destructive">Unable to load this patient record.</p> : null}
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
        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <dl className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            <div><dt className={labelClassName}>Patient ID</dt><dd className={valueClassName}>{displayValue(patient.patientId)}</dd></div>
            <div><dt className={labelClassName}>Date of birth</dt><dd className={valueClassName}>{displayValue(patient.dateOfBirth)}</dd></div>
            <div><dt className={labelClassName}>Age</dt><dd className={valueClassName}>{displayValue(patient.age)}</dd></div>
            <div><dt className={labelClassName}>Phone</dt><dd className={valueClassName}>{displayValue(patient.phone)}</dd></div>
            {patient.ghCardNumber ? <div><dt className={labelClassName}>Ghana Card number</dt><dd className={valueClassName}>{patient.ghCardNumber}</dd></div> : null}
            {patient.nhisNumber ? <div><dt className={labelClassName}>NHIS number</dt><dd className={valueClassName}>{patient.nhisNumber}</dd></div> : null}
            <div><dt className={labelClassName}>Gender</dt><dd className={`${valueClassName} capitalize`}>{displayValue(patient.gender)}</dd></div>
            <div><dt className={labelClassName}>Marital status</dt><dd className={`${valueClassName} capitalize`}>{displayValue(patient.maritalStatus)}</dd></div>
            <div><dt className={labelClassName}>Region</dt><dd className={valueClassName}>{displayValue(patient.region)}</dd></div>
            <div><dt className={labelClassName}>District</dt><dd className={valueClassName}>{displayValue(patient.district)}</dd></div>
            <div><dt className={labelClassName}>Town</dt><dd className={valueClassName}>{displayValue(patient.town)}</dd></div>
            <div><dt className={labelClassName}>Area</dt><dd className={valueClassName}>{displayValue(patient.area)}</dd></div>
            {patient.createdBy ? (
              <div><dt className={labelClassName}>Registered by</dt><dd className={valueClassName}>{patient.createdBy.firstName} {patient.createdBy.lastName}</dd></div>
            ) : null}
          </dl>
        </section>
      ) : null}
    </div>
  );
}
