import { Gender, MaritalStatus } from "@/database/entities/Patient";
import { NewReturning } from "@/database/entities/OPDVisit";

// Shared date-range + demographic filters both reports accept. The
// frontend resolves "Today / This week / This month / This year /
// Custom range" down to a concrete from/to before calling — the backend
// only needs to know how to filter a range, not the labels for one
// (that's presentation, out of scope here).
export type ReportDateRangeFilter = {
  from?: string; // YYYY-MM-DD, inclusive
  to?: string;   // YYYY-MM-DD, inclusive
  gender?: Gender;
  region?: string;
  district?: string;
  town?: string;
  area?: string;
};

export type PatientRegistrationReportRow = {
  // The clinic calls this column "OPD No." on paper, but it's the same
  // fixed number as the patient's own ID (see Patient.patientId) — kept
  // as one field, not duplicated under two names.
  patientId: string;
  name: string;
  age: number | null;
  gender: Gender;
  area: string | null;
  dateRegistered: string;
};

export type OPDVisitReportFilter = ReportDateRangeFilter & {
  newReturning?: NewReturning;
};

export type OPDVisitReportRow = {
  patientId: string;
  name: string;
  age: number | null;
  gender: Gender;
  area: string | null;
  date: string;
  newReturning: NewReturning;
};
