import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "@/lib/api";
import { readDays, storeClosedRange } from "./cache";
import { loadPatients, loadVisits } from "./loader";

vi.mock("@/lib/api", () => ({ apiRequest: vi.fn() }));
vi.mock("./cache", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./cache")>();
  return {
    ...actual,
    readDays: vi.fn().mockResolvedValue([]),
    storeClosedRange: vi.fn().mockResolvedValue(false),
  };
});

describe("OPD report location enrichment", () => {
  beforeEach(() => {
    vi.mocked(apiRequest).mockClear();
    vi.mocked(readDays).mockReset().mockResolvedValue([]);
    vi.mocked(storeClosedRange).mockReset().mockResolvedValue(false);
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

  it("sends OPD marital-status and religion filters to the backend instead of relying on local filtering", async () => {
    await loadVisits(
      { preset: "custom", from: "2026-10-04", to: "2026-10-04" },
      "2026-10-04",
      new AbortController().signal,
      () => {},
      false,
      { maritalStatus: "married", religion: "islam" },
    );

    expect(vi.mocked(apiRequest).mock.calls[0]?.[0]).toBe(
      "/reports/opd-visits?from=2026-10-04&to=2026-10-04&maritalStatus=married&religion=islam&page=1&limit=100"
    );
  });

  it("sends patient-registration marital-status and religion filters to the backend", async () => {
    await loadPatients(
      { preset: "custom", from: "2026-10-04", to: "2026-10-04" },
      "2026-10-04",
      new AbortController().signal,
      () => {},
      false,
      { maritalStatus: "single", religion: "christianity" },
    );

    expect(vi.mocked(apiRequest).mock.calls[0]?.[0]).toBe(
      "/reports/patients?from=2026-10-04&to=2026-10-04&maritalStatus=single&religion=christianity&page=1&limit=100"
    );
  });

  it("replaces stale cached patient rows with an empty server response", async () => {
    vi.mocked(readDays).mockResolvedValue([{
      pid: "PT-45/2026",
      date: "2026-10-19",
      age: 0,
      sex: "male",
      maritalStatus: "unknown",
      hasPhone: false,
      hasDob: false,
      hasGhCard: false,
      hasNhis: false,
      nameKey: null,
      phoneKey: null,
      area: "",
      town: "",
      district: "",
      region: "",
    }]);
    vi.mocked(apiRequest).mockImplementation(async <T,>(path: string) => {
      expect(path).toContain("/reports/patients?");
      return {
        rows: [],
        total: 0,
        pagination: { page: 1, limit: 100, total: 0, totalPages: 0 },
      } as T;
    });

    const result = await loadPatients(
      { preset: "custom", from: "2026-10-19", to: "2026-10-19" },
      "2026-10-22",
      new AbortController().signal,
      () => {},
    );

    expect(result.rows).toEqual([]);
    expect(result.usedCache).toBe(false);
    expect(storeClosedRange).toHaveBeenCalledWith("patients", "2026-10-19", "2026-10-19", new Map());
  });

  it("replaces stale cached OPD rows with an empty server response", async () => {
    vi.mocked(readDays).mockResolvedValue([{
      pid: "PT-45/2026",
      date: "2026-10-19",
      type: "new",
      age: 0,
      sex: "male",
      maritalStatus: "unknown",
      at: null,
      area: "",
      town: "",
      district: "",
      region: "",
    }]);
    vi.mocked(apiRequest).mockImplementation(async <T,>(path: string) => {
      if (path.startsWith("/opd-visits?")) {
        return {
          opdVisits: [],
          pagination: { page: 1, limit: 100, total: 0, totalPages: 0 },
        } as T;
      }
      return {
        rows: [],
        total: 0,
        pagination: { page: 1, limit: 100, total: 0, totalPages: 0 },
      } as T;
    });

    const result = await loadVisits(
      { preset: "custom", from: "2026-10-19", to: "2026-10-19" },
      "2026-10-22",
      new AbortController().signal,
      () => {},
    );

    expect(result.rows).toEqual([]);
    expect(result.usedCache).toBe(false);
    expect(storeClosedRange).toHaveBeenCalledWith("visits", "2026-10-19", "2026-10-19", new Map());
  });

  it("uses cached rows only as an explicitly warned fallback when offline", async () => {
    const cachedRow = {
      pid: "PT-45/2026",
      date: "2026-10-19",
      age: 0,
      sex: "male" as const,
      maritalStatus: "unknown" as const,
      hasPhone: false,
      hasDob: false,
      hasGhCard: false,
      hasNhis: false,
      nameKey: null,
      phoneKey: null,
      area: "",
      town: "",
      district: "",
      region: "",
    };
    vi.mocked(readDays).mockResolvedValue([cachedRow]);
    vi.mocked(apiRequest).mockRejectedValue(new TypeError("Failed to fetch"));

    const result = await loadPatients(
      { preset: "custom", from: "2026-10-19", to: "2026-10-19" },
      "2026-10-22",
      new AbortController().signal,
      () => {},
    );

    expect(result.rows).toEqual([cachedRow]);
    expect(result.usedCache).toBe(true);
    expect(result.warnings).toContain(
      "The server could not be reached, so saved report data is shown and may be out of date."
    );
  });
});
