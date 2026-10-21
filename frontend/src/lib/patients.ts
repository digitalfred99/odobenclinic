import type { Patient, PatientListResponse } from "@/types/patient";
import { apiRequest } from "@/lib/api";
import type {
  ManualPatientCreateInput,
  PatientCreateInput,
  PatientUpdateInput,
  PatientWithOpdCreateInput,
  PatientWithOpdResponse,
} from "@/types/patient";

export function buildPatientUpdateBody(input: PatientUpdateInput, photo?: File | null): BodyInit {
  if (!photo) {
    return JSON.stringify(input);
  }

  const formData = new FormData();
  Object.entries(input).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      formData.append(key, String(value));
    }
  });
  formData.append("image", photo);
  return formData;
}

function toPatientFormData(fields: PatientCreateInput | ManualPatientCreateInput, photo: File): FormData {
  const formData = new FormData();
  Object.entries(fields).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      formData.append(key, String(value));
    }
  });
  formData.append("image", photo);
  return formData;
}

export function createPatientWithOpd(
  input: PatientWithOpdCreateInput,
  photo?: File | null
): Promise<PatientWithOpdResponse> {
  let body: BodyInit;
  if (photo) {
    const formData = new FormData();
    formData.append("patient", JSON.stringify(input.patient));
    formData.append("opdVisit", JSON.stringify(input.opdVisit));
    formData.append("image", photo);
    body = formData;
  } else {
    body = JSON.stringify(input);
  }

  return apiRequest<PatientWithOpdResponse>("/patients/with-opd", {
    method: "POST",
    body,
  });
}

export function createClinicRecordPatient(
  input: ManualPatientCreateInput,
  photo?: File | null
): Promise<Patient> {
  return apiRequest<Patient>("/patients", {
    method: "POST",
    body: photo ? toPatientFormData(input, photo) : JSON.stringify(input),
  });
}

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