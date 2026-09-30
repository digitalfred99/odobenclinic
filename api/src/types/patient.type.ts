import type { Gender, MaritalStatus } from "@/database/entities/Patient";

// ── Create ───────────────────────────────────────────────────────
export type CreatePatientDTO = {
    firstName: string;
    lastName: string;
    phone: string;
    dateOfBirth?: string;
    age?: number;
    region?: string;
    district?: string;
    town?: string;
    area?: string;
    gender: Gender;
    maritalStatus: MaritalStatus
};

// ── Update ───────────────────────────────────────────────────────
export type UpdatePatientDTO = Partial<{
    firstName: string;
    lastName: string;
    phone: string;
    dateOfBirth: string;
    age: number;
    region: string;
    district: string;
    town: string;
    area: string;
    gender: Gender;
    maritalStatus: MaritalStatus
}>;

// ── Filter (list/search) ────────────────────────────────────────
export type FilterPatientDTO = {
    search?: string;
    gender?: Gender;
    maritalStatus?: MaritalStatus;
    // Dedicated administrative-area filters — mainly for reporting
    // ("patients from this region/district") — separate from `search`
    // so the frontend can offer them as their own dropdowns/fields.
    region?: string;
    district?: string;
    town?: string;
    area?: string;
    patientId?: string;
};