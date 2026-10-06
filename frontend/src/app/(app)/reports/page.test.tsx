import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ReportsPage from "./page";

const excelState = vi.hoisted(() => ({
  rows: [] as unknown[][],
  headerBold: false,
  worksheetName: "",
  columns: [] as { header: string; width: number }[],
}));

vi.mock("exceljs", () => ({
  default: {
    Workbook: class {
      xlsx = { writeBuffer: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])) };

      addWorksheet(name: string) {
        excelState.worksheetName = name;
        excelState.rows = [];
        return {
          addRow: (row: unknown[]) => excelState.rows.push(row),
          set columns(columns: { header: string; width: number }[]) {
            excelState.columns = columns;
            excelState.rows = [columns.map((column) => column.header)];
          },
          get columns() {
            return excelState.columns;
          },
          getRow: (rowIndex: number) => ({
            set font(value: { bold?: boolean }) {
              if (rowIndex === 1) excelState.headerBold = value.bold === true;
            },
          }),
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

afterEach(() => {
  vi.restoreAllMocks();
});

beforeEach(() => {
  excelState.rows = [];
  excelState.headerBold = false;
  excelState.worksheetName = "";
  excelState.columns = [];
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  });
});

describe("report export field selection", () => {
  it("exports selected columns in an Excel workbook with a bold header row", async () => {
    let exportedBlob: Blob | undefined;
    vi.spyOn(URL, "createObjectURL").mockImplementation((blob) => {
      if (blob instanceof Blob) exportedBlob = blob;
      return "blob:report";
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    renderReportsPage();

    await screen.findByText("Ama Mensah");
    fireEvent.click(screen.getByRole("button", { name: "Export Excel" }));
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
    expect(excelState.columns[0]).toEqual({ header: "Patient ID / OPD No.", width: 22 });
    expect(excelState.rows[0]).toEqual([
      "Patient ID / OPD No.",
      "First name",
      "Last name",
      "Full name",
      "Date of birth",
      "Phone",
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
      "PT-12/2026",
      "Ama",
      "Mensah",
      "Ama Mensah",
      "1990-10-04",
      "—",
      "female",
      "married",
      "GHA-123456789-0",
      "—",
      "Greater Accra",
      "Accra Metro",
      "Accra",
      "Osu",
      "2026-10-03",
    ]);
    expect(excelState.rows[0]).not.toContain("Age");
    expect(excelState.rows[0]).not.toContain("year");
    expect(excelState.rows[0]).not.toContain("positionInYear");
    expect(excelState.rows[0]).not.toContain("createdBy");
  });

  it("prints only the selected fields while preserving the on-screen report", async () => {
    const print = vi.fn();
    vi.stubGlobal("print", print);
    renderReportsPage();

    await screen.findByText("Ama Mensah");
    fireEvent.click(screen.getByRole("button", { name: "Print report" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Area" }));
    fireEvent.click(screen.getByRole("button", { name: "Print report" }));

    await waitFor(() => expect(print).toHaveBeenCalledOnce());
    const printTable = document.querySelector(".print\\:block table");
    expect(printTable?.textContent).toContain("OPD No.");
    expect(printTable?.textContent).not.toContain("Area");
    expect(printTable?.textContent).toContain("—");
    expect(screen.getByRole("columnheader", { name: "Area" })).toBeInTheDocument();
  });

  it("requires at least one field before continuing", async () => {
    renderReportsPage();

    await screen.findByText("Ama Mensah");
    fireEvent.click(screen.getByRole("button", { name: "Export Excel" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Select all fields" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Select at least one field to continue.");
    expect(screen.getByRole("button", { name: "Export Excel" })).toBeDisabled();
  });
});
