import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Patient, PatientListResponse } from "@/types/patient";

vi.mock("@/lib/api", () => ({
  apiRequest: vi.fn(),
}));

import { apiRequest } from "@/lib/api";
import {
  cachePatientLocation,
  readPatientLocationCache,
  refreshPatientLocationCache,
} from "./patient-location-cache";

function patient(overrides: Partial<Patient> = {}): Patient {
  return {
    id: "patient-1",
    firstName: "Ama",
    lastName: "Mensah",
    region: "Central Region",
    district: "Asikuma-Odoben-Brakwa",
    town: "Odoben",
    area: "Awendadze",
    phone: "0241234567",
    ...overrides,
  };
}

function patientPage(patients: Patient[], page: number, totalPages: number): PatientListResponse {
  return { patients, pagination: { page, limit: 100, total: patients.length, totalPages } };
}

describe("patient location browser cache", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.mocked(apiRequest).mockReset();
  });

  it("loads all patient pages at login and persists only unique location fields", async () => {
    vi.mocked(apiRequest)
      .mockResolvedValueOnce(patientPage([patient()], 1, 2))
      .mockResolvedValueOnce(patientPage([
        patient({ id: "patient-2", phone: "0201234567" }),
        patient({ id: "patient-3", area: "New Area" }),
      ], 2, 2));

    const locations = await refreshPatientLocationCache();

    expect(apiRequest).toHaveBeenCalledWith("/patients?page=1&limit=100");
    expect(apiRequest).toHaveBeenCalledWith("/patients?page=2&limit=100");
    expect(locations).toHaveLength(2);
    expect(readPatientLocationCache()).toEqual(locations);
    expect(window.localStorage.getItem("patient-location-cache-v1")).not.toContain("Ama");
    expect(window.localStorage.getItem("patient-location-cache-v1")).not.toContain("0241234567");
  });

  it("adds a newly saved patient location to the current browser cache", async () => {
    cachePatientLocation(patient({ area: "New Area" }));

    expect(readPatientLocationCache()).toEqual([
      {
        region: "Central Region",
        district: "Asikuma-Odoben-Brakwa",
        town: "Odoben",
        area: "New Area",
      },
    ]);
  });

  it("does not replace the previous cache if a refresh fails", async () => {
    cachePatientLocation(patient());
    vi.mocked(apiRequest).mockRejectedValueOnce(new Error("Network unavailable"));

    await expect(refreshPatientLocationCache()).rejects.toThrow("Network unavailable");
    expect(readPatientLocationCache()).toHaveLength(1);
  });
});
