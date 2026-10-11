import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "@/lib/api";
import { clearDetailsCache } from "@/lib/reports/loader";
import type { PatientRecord } from "@/lib/reports/types";
import { RecordsTable } from "./records-table";

vi.mock("@/lib/api", () => ({ apiRequest: vi.fn() }));

const records: PatientRecord[] = [
  {
    pid: "PT-1/2026", date: "2026-10-04", age: 30, sex: "female",
    area: "", town: "Accra", district: "Accra Metro", region: "Greater Accra",
    hasPhone: false, hasDob: false, hasGhCard: false, hasNhis: false,
    nameKey: null, phoneKey: null,
  },
  {
    pid: "PT-2/2026", date: "2026-10-04", age: 32, sex: "male",
    area: "Osu", town: "Accra", district: "Accra Metro", region: "Greater Accra",
    hasPhone: true, hasDob: true, hasGhCard: true, hasNhis: true,
    nameKey: null, phoneKey: null,
  },
];

function renderTable(missingKey: "" | "duplicate" = "") {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <RecordsTable kind="patients" records={records} missingKey={missingKey} duplicateGroups={[{ reasons: ["Same phone number"], pids: ["PT-1/2026", "PT-2/2026"] }]} />
    </QueryClientProvider>
  );
}

describe("patient report records", () => {
  beforeEach(() => {
    clearDetailsCache();
    vi.mocked(apiRequest).mockImplementation(async <T,>(path: string) => {
      if (path.startsWith("/patients?")) {
        return {
          patients: [{ id: "patient-1", firstName: "Ama", lastName: "Mensah", patientId: "PT-1/2026" }],
          pagination: { page: 1, limit: 100, total: 1, totalPages: 1 },
        } as T;
      }
      return {
        rows: [
          { patientId: "PT-1/2026", name: "Ama Mensah", age: 30, gender: "female", area: null, date: "2026-10-04", dateOfBirth: null, phone: null, ghCardNumber: null, nhisNumber: null },
          { patientId: "PT-2/2026", name: "Kojo Mensah", age: 32, gender: "male", area: "Osu", date: "2026-10-04", dateOfBirth: "1994-01-01", phone: "0241234567", ghCardNumber: "GHA-123456789-0", nhisNumber: "NHIS-1" },
        ],
        total: 2,
        pagination: { page: 1, limit: 100, total: 2, totalPages: 1 },
      } as T;
    });
  });

  it("searches by patient name and shows actionable missing-field details", async () => {
    renderTable();
    expect(await screen.findAllByText("Missing: phone number, date of birth, Ghana Card, NHIS number, area")).not.toHaveLength(0);

    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Ama" } });

    await waitFor(() => expect(screen.getAllByText("Ama Mensah")).not.toHaveLength(0));
    expect(screen.queryByText("Kojo Mensah")).not.toBeInTheDocument();
  });

  it("shows the peer OPD number and match reason in the possible-duplicates list", async () => {
    renderTable("duplicate");
    expect(await screen.findAllByText("Possible match: 2/2026 (Same phone number)")).not.toHaveLength(0);
  });
});
