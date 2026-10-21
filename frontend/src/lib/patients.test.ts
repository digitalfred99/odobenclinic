import { describe, expect, it } from "vitest";
import { buildPatientUpdateBody, prependPatientToList } from "./patients";
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

  describe("buildPatientUpdateBody", () => {
    it("serializes patient edits as JSON when no replacement photo is selected", () => {
      const input = { firstName: "Ama", phone: null };

      expect(buildPatientUpdateBody(input)).toBe(JSON.stringify(input));
    });

    it("serializes flat patient fields and an image for multipart updates", () => {
      const photo = new File(["photo"], "patient.png", { type: "image/png" });
      const body = buildPatientUpdateBody(
        { firstName: "Ama", phone: null, age: 36 },
        photo
      );

      expect(body).toBeInstanceOf(FormData);
      const formData = body as FormData;
      expect(formData.get("firstName")).toBe("Ama");
      expect(formData.get("age")).toBe("36");
      expect(formData.has("phone")).toBe(false);
      expect(formData.get("image")).toBe(photo);
    });
  });

  it("handles an empty cache and avoids duplicate rows", () => {
    const inserted = prependPatientToList(undefined, newPatient);
    const duplicate = prependPatientToList(inserted, newPatient);

    expect(inserted.patients).toEqual([newPatient]);
    expect(duplicate.patients).toEqual([newPatient]);
    expect(duplicate.pagination?.total).toBe(1);
  });
});