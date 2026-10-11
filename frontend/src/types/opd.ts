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
    lastName: string;
    phone?: string | null;
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

export type OPDVisitListResponse = {
  opdVisits: OPDVisit[];
  pagination?: {
    total?: number;
    page?: number;
    limit?: number;
    totalPages?: number;
  };
};
