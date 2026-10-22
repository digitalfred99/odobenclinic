import type { CreatedOPDVisit } from "@/types/opd";

export type PatientGender = "male" | "female";
export type PatientMaritalStatus = "single" | "married" | "divorced" | "widowed";
export const PATIENT_RELIGION_VALUES = ["christianity", "islam", "traditional", "other"] as const;
export const PATIENT_RELIGIONS = [
  { value: "christianity", label: "Christianity" },
  { value: "islam", label: "Islam" },
  { value: "traditional", label: "Traditional" },
  { value: "other", label: "Other" },
] as const;
export type PatientReligion = (typeof PATIENT_RELIGION_VALUES)[number];

export function patientReligionLabel(religion?: string | null) {
  return PATIENT_RELIGIONS.find((option) => option.value === religion)?.label ?? religion ?? "";
}

export type PatientCreateInput = {
  firstName: string;
  lastName: string;
  gender: PatientGender;
  maritalStatus: PatientMaritalStatus;
  religion: PatientReligion;
  otherName?: string;
  dateOfBirth?: string;
  age?: number;
  phone?: string;
  email?: string;
  postalAddress?: string;
  occupation?: string;
  ghCardNumber?: string;
  nhisNumber?: string;
  region?: string;
  district?: string;
  town?: string;
  area?: string;
  confirmedDuplicatePatientId?: string;
};

export type ManualPatientCreateInput = PatientCreateInput & {
  year: number;
  positionInYear: number;
};

export type PatientWithOpdCreateInput = {
  patient: PatientCreateInput;
  opdVisit: {
    date: string;
    remarks?: string;
  };
};

export type PatientUpdateInput = Partial<{
  firstName: string;
  lastName: string;
  otherName: string | null;
  phone: string | null;
  dateOfBirth: string | null;
  age: number | null;
  region: string | null;
  district: string | null;
  town: string | null;
  area: string | null;
  gender: PatientGender;
  maritalStatus: PatientMaritalStatus;
  religion: PatientReligion;
  email: string | null;
  postalAddress: string | null;
  occupation: string | null;
  ghCardNumber: string | null;
  nhisNumber: string | null;
}>;

export type Patient = {
  id: string;
  firstName: string;
  otherName?: string | null;
  lastName: string;
  patientId?: string;
  dateOfBirth?: string | null;
  age?: number | null;
  phone?: string | null;
  ghCardNumber?: string | null;
  nhisNumber?: string | null;
  region?: string | null;
  district?: string | null;
  town?: string | null;
  area?: string | null;
  gender?: PatientGender | null;
  maritalStatus?: PatientMaritalStatus | null;
  religion?: PatientReligion | null;
  email?: string | null;
  postalAddress?: string | null;
  occupation?: string | null;
  imageUrl?: string | null;
  createdBy?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  isDeleted?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type PatientWithOpdResponse = {
  patient: Patient;
  opdVisit: CreatedOPDVisit;
};

export type PatientListResponse = {
  patients: Patient[];
  pagination?: {
    total?: number;
    page?: number;
    limit?: number;
    totalPages?: number;
  };
};
