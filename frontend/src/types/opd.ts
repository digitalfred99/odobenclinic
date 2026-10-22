import type { PatientReligion } from "@/types/patient";

export type OPDVisitNewReturning = "new" | "returning";

export type OPDVisit = {
  id: string;
  date: string;
  remarks?: string | null;
  newReturning?: OPDVisitNewReturning;
  patient: {
    id: string;
    patientId?: string;
    firstName: string;
    otherName?: string | null;
    lastName: string;
    phone?: string | null;
    email?: string | null;
    postalAddress?: string | null;
    occupation?: string | null;
    religion?: PatientReligion | null;
    gender?: "male" | "female" | null;
    ghCardNumber?: string | null;
    nhisNumber?: string | null;
    maritalStatus?: "single" | "married" | "divorced" | "widowed" | null;
    region?: string | null;
    district?: string | null;
    town?: string | null;
    area?: string | null;
    createdAt?: string;
  };

  createdBy?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  createdAt?: string;
  updatedAt?: string;
};

export type CreatedOPDVisit = {
  id: string;
  date: string;
  remarks?: string | null;
  newReturning: OPDVisitNewReturning;
  createdBy?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  createdAt?: string;
};

export type OPDVisitListResponse = {
  opdVisits: OPDVisit[];
  pagination?: {
    total?: number;
    page?: number;
    limit?: number;
    totalPages?: number;
  };
};
