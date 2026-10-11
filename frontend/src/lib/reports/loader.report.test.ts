import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "@/lib/api";
import { loadVisits } from "./loader";

vi.mock("@/lib/api", () => ({ apiRequest: vi.fn() }));

describe("OPD report location enrichment", () => {
  beforeEach(() => {
    vi.mocked(apiRequest).mockImplementation(async <T,>(path: string) => {
      if (path.startsWith("/opd-visits?")) {
        return {
          opdVisits: [{
            id: "visit-1",
            date: "2026-10-04",
            createdAt: "2026-10-04T08:30:00.000Z",
            newReturning: "new",
            patient: {
              id: "patient-1",
              patientId: "PT-1/2026",
              firstName: "Ama",
              lastName: "Mensah",
              region: "Greater Accra",
              district: "Accra Metro",
              town: "Accra",
              area: "Osu",
            },
          }],
          pagination: { page: 1, limit: 100, total: 1, totalPages: 1 },
        } as T;
      }
      return {
        rows: [{
          patientId: "PT-1/2026",
          name: "Ama Mensah",
          age: 30,
          gender: "female",
          area: null,
          date: "2026-10-04",
          newReturning: "new",
        }],
        total: 1,
        pagination: { page: 1, limit: 100, total: 1, totalPages: 1 },
      } as T;
    });
  });

  it("uses the linked patient location returned by the existing OPD visit API", async () => {
    const result = await loadVisits(
      { preset: "custom", from: "2026-10-04", to: "2026-10-04" },
      "2026-10-04",
      new AbortController().signal,
      () => {},
    );

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      town: "Accra",
      area: "Osu",
      district: "Accra Metro",
      region: "Greater Accra",
      at: "2026-10-04T08:30:00.000Z",
    });
  });
});
