import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "@/lib/api";
import { clearDetailsCache } from "@/lib/reports/loader";
import type { PatientRecord, VisitRecord } from "@/lib/reports/types";
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
          patients: [{ id: "patient-1", firstName: "Ama", otherName: "Yaa", lastName: "Mensah", patientId: "PT-1/2026" }],
          pagination: { page: 1, limit: 100, total: 1, totalPages: 1 },
        } as T;
      }
      return {
        rows: [
          { patientId: "PT-1/2026", firstName: "Ama", otherName: "Yaa", lastName: "Mensah", name: "Ama Yaa Mensah", age: 30, gender: "female", area: null, region: "Greater Accra", district: "Accra Metro", town: "Accra", postalAddress: "P.O. Box 12", date: "2026-10-04", dateOfBirth: null, phone: null, ghCardNumber: null, nhisNumber: null },
          { patientId: "PT-2/2026", name: "Kojo Mensah", age: 32, gender: "male", area: "Osu", date: "2026-10-04", dateOfBirth: "1994-01-01", phone: "0240000000", ghCardNumber: "GHA-123456789-0", nhisNumber: "NHIS-1" },
        ],
        total: 2,
        pagination: { page: 1, limit: 100, total: 2, totalPages: 1 },
      } as T;
    });
  });

  it("shows useful search fields in the desktop-expanded hint", () => {
    renderTable();

    const search = screen.getByRole("searchbox", {
      name: "Search records by patient name, other name, phone, date of birth, age, OPD number, Ghana Card, NHIS, location, or occupation",
    });

    expect(search).toHaveAttribute("placeholder", "Search name, OPD No. & more...");
    expect(search.parentElement).toHaveClass("lg:hover:w-[40rem]", "lg:focus-within:w-[40rem]", "lg:transition-[width]");

    fireEvent.mouseEnter(search.parentElement!);
    expect(search).toHaveAttribute(
      "placeholder",
      "Search name, phone, DOB/age, OPD No., Ghana Card/NHIS, location, occupation & more..."
    );

    fireEvent.mouseLeave(search.parentElement!);
    expect(search).toHaveAttribute("placeholder", "Search name, OPD No. & more...");

    fireEvent.focus(search);
    expect(search).toHaveAttribute(
      "placeholder",
      "Search name, phone, DOB/age, OPD No., Ghana Card/NHIS, location, occupation & more..."
    );
  });

  it("searches by patient name and shows actionable missing-field details", async () => {
    renderTable();
    expect(await screen.findAllByText("No missing details in these checks")).not.toHaveLength(0);
    expect(await screen.findAllByText("Missing: phone number, date of birth, Ghana Card, NHIS number, area")).not.toHaveLength(0);

    const patientCard = screen.getAllByText("Additional patient details")[0].closest("li");
    expect(patientCard).not.toBeNull();
    const patientLabels = [...patientCard!.querySelectorAll("dt")].map((label) => label.textContent);
    expect(patientLabels).toEqual(expect.arrayContaining(["Registered", "Age", "Sex", "Marital status"]));
    const detailLabels = [...patientCard!.querySelectorAll("section dl dt")].map((label) => label.textContent);
    expect(detailLabels).toEqual(["Region", "District", "Town", "Area", "Postal address"]);
    expect(detailLabels).not.toContain("Phone");
    expect(detailLabels).not.toContain("Other name");
    const patientWithPhone = screen.getAllByText("Additional patient details")[1].closest("li");
    const contactLocationLabels = [...patientWithPhone!.querySelectorAll("section dl dt")].map((label) => label.textContent);
    expect(contactLocationLabels).toEqual(["Phone", "Date of birth", "Area"]);
    expect(patientCard).toHaveTextContent("Record checks");
    expect(screen.getByText("For a wider, side-by-side view, open this report on a larger screen."))
      .toHaveClass("md:hidden");

    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Yaa" } });

    await waitFor(() => expect(screen.getAllByText("Ama Yaa Mensah")).not.toHaveLength(0));
    expect(apiRequest).toHaveBeenCalledWith(
      "/patients?search=Yaa&page=1&limit=100",
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
    expect(screen.queryByText("Kojo Mensah")).not.toBeInTheDocument();
  });

  it("keeps OPD visit facts and visit-specific details in separate card sections", async () => {
    const visit: VisitRecord = {
      pid: "PT-1/2026",
      date: "2026-10-04",
      type: "returning",
      age: 30,
      sex: "female",
      maritalStatus: "married",
      area: "Osu",
      town: "Accra",
      district: "Accra Metro",
      region: "Greater Accra",
      at: "2026-10-04T09:30:00.000Z",
    };
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <RecordsTable kind="visits" records={[visit]} />
      </QueryClientProvider>
    );

    expect(await screen.findByText("Visit details")).toBeInTheDocument();
    const visitCard = screen.getByText("Visit details").closest("li");
    expect(visitCard).not.toBeNull();
    const visitLabels = [...visitCard!.querySelectorAll("dt")].map((label) => label.textContent);
    expect(visitLabels).toEqual(expect.arrayContaining([
      "Visit date", "Age", "Sex", "Marital status", "Area", "Remarks", "Recorded at", "Visits in report period", "Visit type",
    ]));
  });

  it("shows the peer OPD number and match reason in the possible-duplicates list", async () => {
    renderTable("duplicate");
    expect(await screen.findAllByText("Possible match: 2/2026 (Same phone number)")).not.toHaveLength(0);
  });
});
