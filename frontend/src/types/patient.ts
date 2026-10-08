export type PatientGender = "male" | "female";
export type PatientMaritalStatus = "single" | "married" | "divorced" | "widowed";

export type Patient = {
  id: string;
  firstName: string;
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

export type PatientListResponse = {
  patients: Patient[];
  pagination?: {
    total?: number;
    page?: number;
    limit?: number;
    totalPages?: number;
  };
};
