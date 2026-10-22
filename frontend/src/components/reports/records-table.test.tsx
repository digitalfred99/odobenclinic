import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
          {
            patientId: "PT-1/2026",
            firstName: "Ama",
            otherName: "Yaa",
            lastName: "Mensah",
            name: "Ama Yaa Mensah",
            age: 30,
            gender: "female",
            area: null,
            region: "Greater Accra",
            district: "Accra Metro",
            town: "Accra",
            date: "2026-10-04",
            dateOfBirth: null,
            phone: null,
            ghCardNumber: null,
            nhisNumber: null,
            email: null,
            religion: null,
            postalAddress: null,
            occupation: null,
          },
          {
            patientId: "PT-2/2026",
            name: "Kojo Mensah",
            age: 32,
            gender: "male",
            area: "Osu",
            date: "2026-10-04",
            dateOfBirth: "1994-01-01",
            phone: "0240000000",
            ghCardNumber: "GHA-123456789-0",
            nhisNumber: "NHIS-1",
            email: "kojo@example.test",
            religion: "christianity",
            postalAddress: "P.O. Box 7",
            occupation: "Teacher",
          },
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
    const view = renderTable();
    expect(await screen.findAllByText("No missing details in these checks")).not.toHaveLength(0);
    expect(await screen.findAllByText("9 missing details")).toHaveLength(2);
    expect(screen.queryByRole("columnheader", { name: "Other name" })).not.toBeInTheDocument();
    const disclosures = [...view.container.querySelectorAll("details")];
    expect(disclosures).toHaveLength(1);
    expect(disclosures.every((disclosure) => !disclosure.open)).toBe(true);

    const [expandedDisclosure] = disclosures;
    if (!expandedDisclosure) throw new Error("Expected a record-check disclosure.");
    fireEvent.click(expandedDisclosure.querySelector("summary")!);
    expect(within(expandedDisclosure).getByText(/phone number/)).toBeInTheDocument();
    expect(within(expandedDisclosure).getByText(/date of birth/)).toBeInTheDocument();
    expect(within(expandedDisclosure).getByText(/Ghana Card/)).toBeInTheDocument();
    expect(within(expandedDisclosure).getByText(/NHIS number/)).toBeInTheDocument();
    expect(within(expandedDisclosure).getByText(/area/)).toBeInTheDocument();
    expect(within(expandedDisclosure).getByText(/email address/)).toBeInTheDocument();
    expect(within(expandedDisclosure).getByText(/religion/)).toBeInTheDocument();
    expect(within(expandedDisclosure).getByText(/postal address/)).toBeInTheDocument();
    expect(within(expandedDisclosure).getByText(/occupation/)).toBeInTheDocument();
    expect(within(expandedDisclosure).getByText("These details were not provided by the patient."))
      .toHaveClass("bg-muted/70", "italic", "text-muted-foreground");

    const desktopCheck = screen.getByRole("button", {
      name: "9 missing details. Show missing items.",
    });
    expect(desktopCheck.querySelector("span[aria-hidden='true']")).toHaveTextContent("9");
    expect(desktopCheck.querySelector("span[aria-hidden='true']")).toHaveClass("absolute", "-right-1.5", "-top-1.5");
    expect(desktopCheck).toHaveAttribute("aria-expanded", "false");
    fireEvent.mouseEnter(desktopCheck);
    expect(desktopCheck).toHaveAttribute("aria-expanded", "true");
    const desktopTooltip = screen.getByRole("tooltip");
    expect(desktopTooltip).toHaveTextContent("Missing phone number");
    expect(desktopTooltip).toHaveTextContent("Missing email address");
    expect(desktopTooltip).toHaveTextContent("Missing religion");
    expect(desktopTooltip).toHaveTextContent("Missing postal address");
    expect(desktopTooltip).toHaveTextContent("Missing occupation");
    expect(within(desktopTooltip).getByText("These details were not provided by the patient."))
      .toHaveClass("bg-muted/70", "italic", "text-muted-foreground");
    expect(desktopTooltip.parentElement).toBe(document.body);
    expect(desktopTooltip).toHaveClass("fixed", "z-[200]");
    fireEvent.mouseEnter(desktopTooltip);
    fireEvent.mouseLeave(desktopCheck);
    expect(desktopCheck).toHaveAttribute("aria-expanded", "true");
    fireEvent.mouseLeave(desktopTooltip);
    await waitFor(() => expect(desktopCheck).toHaveAttribute("aria-expanded", "false"));

    fireEvent.click(desktopCheck);
    expect(desktopCheck).toHaveAttribute("aria-expanded", "true");
    fireEvent.mouseLeave(desktopCheck);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    fireEvent.click(desktopCheck);
    expect(desktopCheck).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("tooltip")).toBeInTheDocument();

    fireEvent.pointerDown(screen.getByRole("tooltip"));
    expect(desktopCheck).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("tooltip")).toBeInTheDocument();

    fireEvent.pointerDown(document.body);
    expect(desktopCheck).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    const patientCard = screen.getAllByText("Additional patient details")[0].closest("li");
    expect(patientCard).not.toBeNull();
    const patientLabels = [...patientCard!.querySelectorAll("dt")].map((label) => label.textContent);
    expect(patientLabels).toEqual(expect.arrayContaining(["Registered", "Age", "Sex", "Marital status"]));
    const detailLabels = [...patientCard!.querySelectorAll("section dl dt")].map((label) => label.textContent);
    expect(detailLabels).toEqual(["Region", "District", "Town", "Area"]);
    expect(detailLabels).not.toContain("Phone");
    expect(detailLabels).not.toContain("Other name");
    const patientWithPhone = screen.getAllByText("Additional patient details")[1].closest("li");
    const contactLocationLabels = [...patientWithPhone!.querySelectorAll("section dl dt")].map((label) => label.textContent);
    expect(contactLocationLabels).toEqual([
      "Phone",
      "Email",
      "Date of birth",
      "Religion",
      "Occupation",
      "Area",
      "Postal address",
    ]);
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
