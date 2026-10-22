import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "@/lib/api";
import ReportsPage from "./page";

const excelState = vi.hoisted(() => ({
  rows: [] as unknown[][],
  headerBold: false,
  headerFill: "",
  worksheetName: "",
  columns: [] as { header: string; width: number }[],
}));

const navigation = vi.hoisted(() => ({
  replace: vi.fn(),
  search: "",
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/reports",
  useRouter: () => navigation,
  useSearchParams: () => new URLSearchParams(navigation.search),
}));

vi.mock("exceljs", () => ({
  default: {
    Workbook: class {
      xlsx = { writeBuffer: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])) };

      addWorksheet(name: string) {
        excelState.worksheetName = name;
        excelState.rows = [];
        const createRow = (rowIndex: number) => ({
          set font(value: { bold?: boolean }) {
            if (value.bold) excelState.headerBold = true;
          },
          set fill(value: { fgColor?: { argb?: string } }) {
            if (rowIndex === 1 && value.fgColor?.argb) excelState.headerFill = value.fgColor.argb;
          },
          set height(_value: number) {},
          set alignment(_value: { vertical?: string; wrapText?: boolean }) {},
          eachCell: (_options: { includeEmpty: boolean }, callback: (cell: { border?: unknown }) => void) => callback({}),
        });
        return {
          addRow: (row: unknown[]) => {
            excelState.rows.push(row);
            return createRow(excelState.rows.length);
          },
          set columns(columns: { header: string; width: number }[]) {
            excelState.columns = columns;
            excelState.rows = [columns.map((column) => column.header)];
          },
          get columns() {
            return excelState.columns;
          },
          mergeCells: () => {},
          getRow: (rowIndex: number) => createRow(rowIndex),
          eachRow: (callback: (row: ReturnType<typeof createRow>, rowIndex: number) => void) => {
            excelState.rows.forEach((_row, index) => callback(createRow(index + 1), index + 1));
          },
        };
      }
    },
  },
}));

vi.mock("@/lib/api", () => ({
  apiRequest: vi.fn().mockResolvedValue({
    rows: [{
      patientId: "PT-12/2026",
      firstName: "Ama",
      lastName: "Mensah",
      name: "Ama Mensah",
      dateOfBirth: "1990-10-04",
      age: 36,
      phone: null,
      email: null,
      postalAddress: null,
      occupation: null,
      religion: null,
      region: "Greater Accra",
      district: "Accra Metro",
      town: "Accra",
      gender: "female",
      maritalStatus: "married",
      area: "Osu",
      ghCardNumber: "GHA-123456789-0",
      nhisNumber: "",
      date: "2026-10-04",
      dateRegistered: "2026-10-03",
      newReturning: "returning",
    }],
    total: 1,
    pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
  }),
}));

function renderReportsPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ReportsPage />
    </QueryClientProvider>
  );
}

function openExport(format: "Excel" | "CSV" | "PDF" | "Print report") {
  fireEvent.click(screen.getByRole("button", { name: "Report actions" }));
  fireEvent.click(screen.getByRole("menuitem", { name: format === "Print report" ? format : `Export ${format}` }));
}

afterEach(() => {
  vi.restoreAllMocks();
});

beforeEach(() => {
  navigation.replace.mockClear();
  navigation.search = "";
  vi.mocked(apiRequest).mockReset().mockImplementation(async <T,>(path: string) => {
    const params = new URLSearchParams(path.split("?")[1] ?? "");
    if (path.startsWith("/opd-visits?")) {
      return {
        opdVisits: [],
        pagination: { page: 1, limit: 100, total: 0, totalPages: 0 },
      } as T;
    }
    const row = {
      patientId: "PT-12/2026",
      firstName: "Ama",
      lastName: "Mensah",
      name: "Ama Mensah",
      dateOfBirth: "1990-10-04",
      age: 36,
      phone: null,
      email: null,
      postalAddress: null,
      occupation: null,
      religion: null,
      region: "Greater Accra",
      district: "Accra Metro",
      town: "Accra",
      gender: "female",
      maritalStatus: "married",
      area: "Osu",
      ghCardNumber: "GHA-123456789-0",
      nhisNumber: "",
      date: "2026-10-04",
      dateRegistered: "2026-10-03",
      newReturning: "returning",
    };
    const date = path.startsWith("/reports/patients") ? row.dateRegistered : row.date;
    const from = params.get("from");
    const to = params.get("to");
    const maritalStatus = params.get("maritalStatus");
    const religion = params.get("religion");
    const rows = (!from || date >= from)
      && (!to || date <= to)
      && (!maritalStatus || row.maritalStatus === maritalStatus)
      && (!religion || row.religion === religion)
      ? [row]
      : [];
    return {
      rows,
      total: rows.length,
      pagination: { page: 1, limit: 20, total: rows.length, totalPages: rows.length ? 1 : 0 },
    } as T;
  });
  excelState.rows = [];
  excelState.headerBold = false;
  excelState.headerFill = "";
  excelState.worksheetName = "";
  excelState.columns = [];
  document.documentElement.style.setProperty("--primary", "#1b5e5c");
  document.documentElement.style.setProperty("--primary-foreground", "#f5f7f4");
  document.documentElement.style.setProperty("--foreground", "#172321");
  document.documentElement.style.setProperty("--muted-foreground", "#556d67");
  document.documentElement.style.setProperty("--muted", "#f5f7f4");
  document.documentElement.style.setProperty("--secondary", "#dfeee9");
  document.documentElement.style.setProperty("--accent", "#6aae9a");
  document.documentElement.style.setProperty("--border", "#d7e3df");
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  });
});

describe("report export field selection", () => {
  it("opens report actions and saves views through the working action menu", async () => {
    renderReportsPage();
    expect(await screen.findByText("Compare", { selector: "span" })).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "Report actions" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Save current view…" }));

    expect(screen.getByRole("dialog", { name: "Save this report view" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("View name"), { target: { value: "Reception view" } });
    fireEvent.click(screen.getByRole("button", { name: "Save view" }));

    fireEvent.click(screen.getByRole("button", { name: "Report actions" }));
    expect(screen.getByRole("menuitem", { name: "Reception view" })).toBeInTheDocument();
  });

  it("filters report records by marital status", async () => {
    renderReportsPage();
    await screen.findAllByText("Ama Mensah");
    fireEvent.click(screen.getByRole("button", { name: "Report actions" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Filters" }));
    fireEvent.change(screen.getByLabelText("Marital status"), { target: { value: "single" } });
    fireEvent.click(screen.getByRole("button", { name: "Done" }));

    expect(await screen.findByText("No records match the current period and filters.")).toBeInTheDocument();
    expect(vi.mocked(apiRequest).mock.calls.some(([path]) => path.includes("maritalStatus=single"))).toBe(true);
  });

  it("enriches OPD report rows with remarks from the existing visit list API", async () => {
    renderReportsPage();
    await screen.findAllByText("Ama Mensah");
    vi.mocked(apiRequest).mockImplementation(async <T,>(path: string) => {
      const params = new URLSearchParams(path.split("?")[1] ?? "");
      const from = params.get("from") ?? params.get("dateFrom");
      const to = params.get("to") ?? params.get("dateTo");
      const inRange = (date: string) => (!from || date >= from) && (!to || date <= to);
      if (path.startsWith("/opd-visits?")) {
        const opdVisits = [{
          id: "visit-12",
          date: "2026-10-04",
          createdAt: "2026-10-04T08:30:00.000Z",
          newReturning: "returning" as const,
          remarks: "Review blood pressure next week.",
          patient: {
            id: "patient-12",
            patientId: "PT-12/2026",
            firstName: "Ama",
            lastName: "Mensah",
          },
        }].filter((visit) => inRange(visit.date));
        return {
          opdVisits,
          pagination: { page: 1, limit: 100, total: 1, totalPages: 1 },
        } as T;
      }
      const rows = [{
        patientId: "PT-12/2026",
        name: "Ama Mensah",
        age: 36,
        gender: "female" as const,
        area: "Osu",
        date: "2026-10-04",
        newReturning: "returning" as const,
      }].filter((row) => inRange(row.date));
      return {
        rows,
        total: 1,
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      } as T;
    });
    fireEvent.click(screen.getByRole("button", { name: "OPD visits" }));

    const table = screen.getByRole("table");
    expect(await within(table).findByText("Review blood pressure next week.")).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "Visit remarks" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Visit recorded at" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Visits in report period" })).toBeInTheDocument();
    expect(within(table).getByText("4 Oct 2026, 8:30 AM")).toBeInTheDocument();
    expect(screen.getAllByRole("cell").map((cell) => cell.textContent?.trim())).toContain("1");
    expect(screen.getByText("12/2026", { selector: "td" })).toBeInTheDocument();
  });

  it("exports selected columns in a branded Excel workbook with green table headers", async () => {
    let exportedBlob: Blob | undefined;
    vi.spyOn(URL, "createObjectURL").mockImplementation((blob) => {
      if (blob instanceof Blob) exportedBlob = blob;
      return "blob:report";
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    renderReportsPage();

    await screen.findAllByText("Ama Mensah");
    openExport("Excel");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "Year" })).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "Position in year" })).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "Registered by" })).not.toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Ghana Card number" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Date of birth" })).toBeChecked();
    expect(screen.queryByRole("checkbox", { name: "Patient record UUID" })).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "Deleted status" })).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "Record created at" })).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "Record updated at" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: "Age" }));
    fireEvent.click(screen.getByRole("button", { name: "Export Excel" }));

    await waitFor(() => expect(exportedBlob).toBeDefined());
    expect(exportedBlob?.type).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(excelState.worksheetName).toBe("Patient registrations");
    expect(excelState.headerBold).toBe(true);
    expect(excelState.headerFill).toBe("FF1B5E5C");
    expect(excelState.columns[0]).toEqual({ header: "Patient ID / OPD No.", width: 22 });
    expect(excelState.rows[0]).toEqual([
      "Patient ID / OPD No.",
      "First name",
      "Other name",
      "Last name",
      "Full name",
      "Date of birth",
      "Phone",
      "Email",
      "Postal address",
      "Occupation",
      "Religion",
      "Gender",
      "Marital status",
      "Ghana Card number",
      "NHIS number",
      "Region",
      "District",
      "Town",
      "Area",
      "Date registered",
    ]);
    expect(excelState.rows[1]).toEqual([
      "12/2026",
      "Ama",
      "—",
      "Mensah",
      "Ama Mensah",
      "4 Oct 1990",
      "—",
      "—",
      "—",
      "—",
      "—",
      "female",
      "married",
      "GHA-123456789-0",
      "—",
      "Greater Accra",
      "Accra Metro",
      "Accra",
      "Osu",
      "3 Oct 2026",
    ]);
    expect(excelState.rows[0]).not.toContain("Age");
    expect(excelState.rows[0]).not.toContain("year");
    expect(excelState.rows[0]).not.toContain("positionInYear");
    expect(excelState.rows[0]).not.toContain("createdBy");
  });

  it("exports all matched rows as UTF-8 CSV with a byte-order mark", async () => {
    let exportedBlob: Blob | undefined;
    vi.spyOn(URL, "createObjectURL").mockImplementation((blob) => {
      if (blob instanceof Blob) exportedBlob = blob;
      return "blob:report";
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    renderReportsPage();

    await screen.findAllByText("Ama Mensah");
    openExport("CSV");
    fireEvent.click(screen.getByRole("button", { name: "Export CSV" }));

    await waitFor(() => expect(exportedBlob).toBeDefined());
    if (!exportedBlob) throw new Error("Expected the report to create a CSV download.");
    expect(exportedBlob.type).toBe("text/csv;charset=utf-8");
    const csv = await exportedBlob.text();
    const bytes = new Uint8Array(await exportedBlob.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(csv).toContain('"ODOBEN HEALTH CENTER"');
    expect(csv).toContain('"Patient registration report"');
    expect(csv).toContain('"Patient ID / OPD No."');
    expect(csv).toContain('"12/2026"');
    expect(csv).toContain('"3 Oct 2026"');
  });

  it("prints only the selected fields while preserving the on-screen report", async () => {
    const print = vi.fn();
    vi.stubGlobal("print", print);
    renderReportsPage();

    await screen.findAllByText("Ama Mensah");
    openExport("Print report");
    fireEvent.click(screen.getByRole("checkbox", { name: "Area" }));
    fireEvent.click(screen.getByRole("button", { name: "Print report" }));

    await waitFor(() => expect(print).toHaveBeenCalledOnce());
    const printTable = document.querySelector(".print\\:block table");
    expect(printTable).toHaveClass("print-table");
    const printHeader = printTable?.querySelector("thead th");
    expect(printHeader).toHaveClass("bg-primary", "text-primary-foreground");
    expect(printTable?.textContent).toContain("OPD No.");
    expect(printTable?.textContent).not.toContain("Area");
    expect(printTable?.textContent).toContain("—");
    expect(screen.getByRole("columnheader", { name: "Area" })).toBeInTheDocument();
  });

  it("requires at least one field before continuing", async () => {
    renderReportsPage();

    await screen.findAllByText("Ama Mensah");
    openExport("Excel");
    fireEvent.click(screen.getByRole("checkbox", { name: "Select all fields" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Select at least one field to continue.");
    expect(screen.getByRole("button", { name: "Export Excel" })).toBeDisabled();
  });

  it("offers date presets and keeps report filters shareable in the URL", async () => {
    renderReportsPage();
    await screen.findAllByText("Ama Mensah");
    fireEvent.change(screen.getByLabelText("Period"), { target: { value: "thisMonth" } });

    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith(
      expect.stringContaining("period=thisMonth"),
      { scroll: false }
    ));
    const latestUrl = navigation.replace.mock.calls.at(-1)?.[0];
    expect(latestUrl).toContain("period=thisMonth");
    expect(latestUrl).not.toContain("from=");
    expect(screen.getAllByText(/Period:/).length).toBeGreaterThan(0);
  });

  it("rejects a custom period whose start date is after its end date", async () => {
    renderReportsPage();
    await screen.findAllByText("Ama Mensah");
    fireEvent.change(screen.getByLabelText("Period"), { target: { value: "custom" } });
    fireEvent.change(screen.getByLabelText("From date"), { target: { value: "2026-10-10" } });
    fireEvent.change(screen.getByLabelText("To date"), { target: { value: "2026-10-01" } });

    expect(await screen.findByRole("alert")).toHaveTextContent("The start date must be on or before the end date.");
  });
});
