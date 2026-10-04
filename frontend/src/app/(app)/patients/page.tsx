"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { PatientForm } from "@/components/features/patients/patient-form";
import { PatientSearchList } from "@/components/features/patients/patient-search";
import { Button } from "@/components/ui/button";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { prependPatientToList } from "@/lib/patients";
import type { PatientFormValues } from "@/schemas/patient";
import type { Patient, PatientListResponse } from "@/types/patient";

export default function PatientsPage() {
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [patientListVersion, setPatientListVersion] = useState(0);

  const handleSubmit = async (values: PatientFormValues) => {
    setNotice(null);
    setError(null);

    try {
      const patient = await apiRequest<Patient>("/patients", {
        method: "POST",
        body: JSON.stringify(values),
      });

      queryClient.setQueryData<PatientListResponse>(["patients", ""], (current) => prependPatientToList(current, patient));
      setPatientListVersion((version) => version + 1);
      setNotice(patient.patientId ? `Patient registered successfully: ${patient.patientId}` : "Patient registered successfully.");
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to create patient.";
      setError(message);
      return false;
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Patients</p>
          <h2 className="mt-2 text-3xl font-semibold text-foreground">Patient search and registration</h2>
        </div>
        <Button type="button" variant="secondary">New patient</Button>
      </div>

      {notice ? <FeedbackMessage message={notice} kind="success" onDismiss={() => setNotice(null)} /> : null}
      {error ? <FeedbackMessage message={error} kind="error" onDismiss={() => setError(null)} /> : null}

      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <PatientSearchList key={patientListVersion} />
        <PatientForm onSubmit={handleSubmit} submitLabel="Create patient" clearOnSuccess />
      </div>
    </div>
  );
}
