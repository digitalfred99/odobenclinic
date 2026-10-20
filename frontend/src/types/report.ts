export type ReportRow = {
  patientId: string;
  firstName?: string;
  otherName?: string | null;
  lastName?: string;
  name: string;
  dateOfBirth?: string | null;
  age: number | null;
  phone?: string | null;
  region?: string | null;
  district?: string | null;
  town?: string | null;
  gender: "male" | "female";
  maritalStatus?: "single" | "married" | "divorced" | "widowed" | null;
  area: string | null;
  ghCardNumber?: string | null;
  nhisNumber?: string | null;
  date?: string;
  newReturning?: "new" | "returning";
  remarks?: string | null;
  visitRecordedAt?: string | null;
  visitsInReport?: number;
  dateRegistered?: string;
};

export type ReportListResponse = {
  rows: ReportRow[];
  total: number;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};
