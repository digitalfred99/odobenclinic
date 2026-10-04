export type ReportRow = {
  patientId: string;
  name: string;
  age: number | null;
  gender: "male" | "female";
  area: string | null;
  date: string;
  newReturning?: "new" | "returning";
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
