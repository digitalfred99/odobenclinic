import type { Patient, PatientListResponse } from "@/types/patient";

export function prependPatientToList(
  current: PatientListResponse | undefined,
  patient: Patient
): PatientListResponse {
  const alreadyPresent = current?.patients.some((existingPatient) => existingPatient.id === patient.id) ?? false;
  const existingPatients = current?.patients.filter((existingPatient) => existingPatient.id !== patient.id) ?? [];
  const pageLimit = current?.pagination?.limit ?? 20;
  const total = (current?.pagination?.total ?? current?.patients.length ?? 0) + (alreadyPresent ? 0 : 1);

  return {
    patients: [patient, ...existingPatients],
    pagination: {
      page: current?.pagination?.page ?? 1,
      limit: pageLimit,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageLimit)),
    },
  };
}