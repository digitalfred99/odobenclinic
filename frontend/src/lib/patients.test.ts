import { describe, expect, it } from "vitest";
import { prependPatientToList } from "./patients";
import type { Patient, PatientListResponse } from "../types/patient";

const firstPatient: Patient = { id: "patient-1", firstName: "Existing", lastName: "Patient" };
const newPatient: Patient = { id: "patient-2", firstName: "New", lastName: "Patient", patientId: "PT-2/2026" };

describe("prependPatientToList", () => {
  it("places the created patient first and increments pagination", () => {
    const current: PatientListResponse = {
      patients: [firstPatient],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    };

    const result = prependPatientToList(current, newPatient);

    expect(result.patients).toEqual([newPatient, firstPatient]);
    expect(result.pagination?.total).toBe(2);
  });

  it("handles an empty cache and avoids duplicate rows", () => {
    const inserted = prependPatientToList(undefined, newPatient);
    const duplicate = prependPatientToList(inserted, newPatient);

    expect(inserted.patients).toEqual([newPatient]);
    expect(duplicate.patients).toEqual([newPatient]);
    expect(duplicate.pagination?.total).toBe(1);
  });
});