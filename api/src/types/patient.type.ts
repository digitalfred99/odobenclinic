import type { Gender, MaritalStatus, Religion } from "@/database/entities/Patient";

// ── Create ───────────────────────────────────────────────────────
export type CreatePatientDTO = {
    firstName: string;
    lastName: string;
    otherName?: string;
    phone?: string;
    dateOfBirth?: string;
    age?: number;
    email?: string;
    region?: string;
    district?: string;
    town?: string;
    area?: string;
    postalAddress?: string;
    gender: Gender;
    maritalStatus: MaritalStatus;
    occupation?: string;
    religion: Religion; 
    ghCardNumber?: string;
    nhisNumber?: string;
    confirmedDuplicatePatientId?: string;
};

// ── Update ───────────────────────────────────────────────────────
export type UpdatePatientDTO = Partial<{
    firstName: string;
    lastName: string;
    otherName: string;
    phone: string;
    email: string;
    dateOfBirth: string;
    age: number;
    postalAddress: string;
    region: string;
    district: string;
    town: string;
    area: string;
    gender: Gender;
    maritalStatus: MaritalStatus;
    occupation: string;
    religion: Religion;
    ghCardNumber: string;
    nhisNumber: string;
}>;

// ── Filter (list/search) ────────────────────────────────────────
export type FilterPatientDTO = {
    search?: string;
    gender?: Gender;
    maritalStatus?: MaritalStatus;
    religion?: Religion;
    // Dedicated administrative-area filters — mainly for reporting
    // ("patients from this region/district") — separate from `search`
    // so the frontend can offer them as their own dropdowns/fields.
    region?: string;
    district?: string;
    town?: string;
    area?: string;
    patientId?: string;
};

// Used only by the "add existing patient" endpoint (no OPD).
export type CreatePatientManualDTO = CreatePatientDTO & {
    year: number;
    positionInYear: number;
};