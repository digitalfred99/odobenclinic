import type { CreatedOPDVisit } from "@/types/opd";

export type PatientGender = "male" | "female";
export type PatientMaritalStatus = "single" | "married" | "divorced" | "widowed";

export type PatientCreateInput = {
  firstName: string;
  lastName: string;
  gender: PatientGender;
  maritalStatus: PatientMaritalStatus;
  otherName?: string;
  dateOfBirth?: string;
  age?: number;
  phone?: string;
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
