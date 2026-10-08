"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ApiError, apiRequest } from "@/lib/api";
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
  const [photoError, setPhotoError] = useState<string | null>(null);

  const handleSubmit = async (values: PatientFormValues, photo: File | null) => {
    setNotice(null);
    setError(null);
    setPhotoError(null);

    try {
      let body: BodyInit;
      if (photo) {
        const formData = new FormData();
        Object.entries(values).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== "") {
            formData.append(key, String(value));
          }
        });
        formData.append("image", photo);
        body = formData;
      } else {
        body = JSON.stringify(values);
      }

      const patient = await apiRequest<Patient>("/patients", {
        method: "POST",
        body,
      });

      queryClient.setQueryData<PatientListResponse>(["patients", ""], (current) => prependPatientToList(current, patient));
      void queryClient.invalidateQueries({ queryKey: ["patients"] });
      setNotice(patient.patientId ? `Patient registered successfully: ${patient.patientId}` : "Patient registered successfully.");
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to create patient.";
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
        <PatientSearchList />
        <PatientForm
          onSubmit={handleSubmit}
          submitLabel="Create patient"
          clearOnSuccess
          enablePhoto
          photoError={photoError}
          onPhotoChange={handlePhotoChange}
        />
      </div>
    </div>
  );
}
