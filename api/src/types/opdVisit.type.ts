// ── Create ───────────────────────────────────────────────────────
export type CreateOPDVisitDTO = {
    // Optional — defaults to today if omitted (see OPDVisitService.create).
    // Was previously typed as required even though the service always
    // treated it as optional; this just makes the type match reality.
    date?: string;
    remarks?: string;
    patient: string;
};

// ── Update ───────────────────────────────────────────────────────
export type UpdateOPDVisitDTO = Partial<{
    date: string;
    remarks: string;
}>;

// ── Filter (list/search) ────────────────────────────────────────
export type FilterOPDVisitDTO = {
    search?: string;
    // Inclusive date range (YYYY-MM-DD), the backbone filter that
    // "Today / This week / This month / This year / Custom range" in the
    // frontend all resolve down to.
    dateFrom?: string;
    dateTo?: string;
    patientId?: string;
};