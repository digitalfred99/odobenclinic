import type { PatientReligion } from "@/types/patient";

export type Sex = "male" | "female" | "other";
export type VisitType = "new" | "returning" | "unknown";
export type MaritalStatus = "single" | "married" | "divorced" | "widowed" | "unknown";
export type MaritalFilter = Exclude<MaritalStatus, "unknown"> | "";
export type RecordKind = "visits" | "patients";
export type MissingKey = "phone" | "dob" | "ghCard" | "nhis" | "area" | "duplicate";

export type Place = { area: string; town: string; district: string; region: string };

/**
 * What the browser cache keeps for a visit. No names, phone numbers or card numbers.
 * `pid` is the OPD number, which is needed to count unique patients.
 */
export type VisitRecord = Place & {
  pid: string;
  date: string; // yyyy-MM-dd
  type: VisitType;
  age: number | null;
  sex: Sex;
  maritalStatus?: MaritalStatus;
  at: string | null; // when the visit was recorded, used for the busy-hours chart
};

/** Yes/no flags and one-way hashes only (used to spot possible duplicates). */
export type PatientRecord = Place & {
  pid: string;
  date: string; // date registered, yyyy-MM-dd
  age: number | null;
  sex: Sex;
  maritalStatus?: MaritalStatus;
  hasPhone: boolean;
  hasDob: boolean;
  hasGhCard: boolean;
  hasNhis: boolean;
  nameKey: string | null;
  phoneKey: string | null;
};

export type Slice = {
  sex: Sex | "";
  maritalStatus: MaritalFilter;
  religion: PatientReligion | "";
  ageBand: string;
  type: VisitType | "";
  area: string;
  town: string;
  district: string;
  region: string;
  weekday: number | null; // 0 = Monday
  missing: MissingKey | "";
};

export const EMPTY_SLICE: Slice = {
  sex: "",
  maritalStatus: "",
  religion: "",
  ageBand: "",
  type: "",
  area: "",
  town: "",
  district: "",
  region: "",
  weekday: null,
  missing: "",
};

export type LoadProgress = { label: string; done: number; total: number };

export type Dataset<T> = { rows: T[]; warnings: string[]; usedCache: boolean };
