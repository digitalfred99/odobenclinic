"use client";

import { useMemo, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { useQuery } from "@tanstack/react-query";
import { Download, Filter, Printer } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { Input } from "@/components/ui/input";
import type { ReportListResponse, ReportRow } from "@/types/report";

const REPORT_LIMIT = 20;
const EXPORT_LIMIT = 100;
const EXPORT_BATCH_SIZE = 4;

type ReportType = "patients" | "opd-visits";
type ReportField =
  | "patientId"
  | "firstName"
  | "lastName"
  | "name"
  | "dateOfBirth"
  | "age"
  | "phone"
  | "region"
  | "district"
  | "town"
  | "gender"
  | "maritalStatus"
  | "area"
  | "ghCardNumber"
  | "nhisNumber"
  | "date"
  | "dateRegistered"
  | "newReturning";
type SelectionAction = "excel" | "print";

type ReportFieldOption = {
  key: ReportField;
  label: string;
};

function getReportFields(reportType: ReportType): ReportFieldOption[] {
  if (reportType === "patients") {
    return [
      { key: "patientId", label: "Patient ID / OPD No." },
      { key: "firstName", label: "First name" },
      { key: "lastName", label: "Last name" },
      { key: "name", label: "Full name" },
      { key: "dateOfBirth", label: "Date of birth" },
      { key: "age", label: "Age" },
      { key: "phone", label: "Phone" },
      { key: "gender", label: "Gender" },
      { key: "maritalStatus", label: "Marital status" },
      { key: "ghCardNumber", label: "Ghana Card number" },
      { key: "nhisNumber", label: "NHIS number" },
      { key: "region", label: "Region" },
      { key: "district", label: "District" },
      { key: "town", label: "Town" },
      { key: "area", label: "Area" },
      { key: "dateRegistered", label: "Date registered" },
    ];
  }

  return [
    { key: "patientId", label: "OPD No." },
    { key: "name", label: "Name" },
    { key: "age", label: "Age" },
    { key: "gender", label: "Gender" },
    { key: "area", label: "Area" },
    { key: "date", label: "Visit date" },
    { key: "newReturning", label: "New/Returning" },
  ];
}

function getReportFieldValue(row: ReportRow, reportType: ReportType, field: ReportField): string | number | boolean | null {
  switch (field) {
    case "patientId":
      return row.patientId;
    case "firstName":
      return row.firstName ?? null;
    case "lastName":
      return row.lastName ?? null;
    case "name":
      return row.name;
    case "dateOfBirth":
      return row.dateOfBirth ?? null;
    case "age":
      return row.age;
    case "phone":
      return row.phone ?? null;
    case "region":
      return row.region ?? null;
    case "district":
      return row.district ?? null;
    case "town":
      return row.town ?? null;
    case "gender":
      return row.gender;
    case "maritalStatus":
      return row.maritalStatus ?? null;
    case "area":
      return row.area;
    case "ghCardNumber":
      return row.ghCardNumber ?? null;
    case "nhisNumber":
      return row.nhisNumber ?? null;
    case "date":
      return reportType === "patients" ? (row.dateRegistered ?? row.date ?? null) : row.date ?? null;
    case "dateRegistered":
      return row.dateRegistered ?? null;
    case "newReturning":
      return row.newReturning ?? null;
  }
}

function formatExportValue(value: string | number | boolean | null | undefined): string | number | boolean {
  return value == null || (typeof value === "string" && value.trim() === "") ? "—" : value;
}

function getVisibleReportFields(reportType: ReportType): ReportFieldOption[] {
  return reportType === "patients"
    ? [
        { key: "patientId", label: "OPD No." },
        { key: "name", label: "Name" },
        { key: "age", label: "Age" },
        { key: "gender", label: "Gender" },
        { key: "area", label: "Area" },
        { key: "dateRegistered", label: "Date registered" },
      ]
    : getReportFields(reportType);
}

async function fetchAllReportRows(endpoint: string, params: URLSearchParams): Promise<ReportRow[]> {
  const firstPageParams = new URLSearchParams(params);
  firstPageParams.set("page", "1");
  firstPageParams.set("limit", String(EXPORT_LIMIT));

  const firstPage = await apiRequest<ReportListResponse>(`${endpoint}?${firstPageParams.toString()}`);
  const allRows = [...firstPage.rows];

  for (let firstBatchPage = 2; firstBatchPage <= firstPage.pagination.totalPages; firstBatchPage += EXPORT_BATCH_SIZE) {
    const pageNumbers = Array.from(
      { length: Math.min(EXPORT_BATCH_SIZE, firstPage.pagination.totalPages - firstBatchPage + 1) },
      (_, index) => firstBatchPage + index
    );
    const pages = await Promise.all(pageNumbers.map(async (currentPage) => {
      const pageParams = new URLSearchParams(firstPageParams);
      pageParams.set("page", String(currentPage));
      return apiRequest<ReportListResponse>(`${endpoint}?${pageParams.toString()}`);
    }));
    pages.forEach((pageResponse) => allRows.push(...pageResponse.rows));
  }

  return allRows;
}

export default function ReportsPage() {
  const [reportType, setReportType] = useState<ReportType>("patients");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [gender, setGender] = useState("");
  const [region, setRegion] = useState("");
  const [district, setDistrict] = useState("");
  const [town, setTown] = useState("");
  const [area, setArea] = useState("");
  const [newReturning, setNewReturning] = useState("");
  const [page, setPage] = useState(1);
  const [isExporting, setIsExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [selectionAction, setSelectionAction] = useState<SelectionAction | null>(null);
  const [draftFields, setDraftFields] = useState<ReportField[]>([]);
  const [printFields, setPrintFields] = useState<ReportField[]>([]);

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (gender) params.set("gender", gender);
    if (region) params.set("region", region);
    if (district) params.set("district", district);
    if (town) params.set("town", town);
    if (area) params.set("area", area);
    if (reportType === "opd-visits" && newReturning) params.set("newReturning", newReturning);
    params.set("page", String(page));
    params.set("limit", String(REPORT_LIMIT));
    return params;
  }, [area, district, from, gender, newReturning, page, region, reportType, to, town]);

  const endpoint = reportType === "patients" ? "/reports/patients" : "/reports/opd-visits";
  const reportFields = getReportFields(reportType);
  const visibleFields = getVisibleReportFields(reportType);

  const { data, isLoading, error } = useQuery({
    queryKey: ["report", reportType, queryParams.toString()],
    queryFn: async () => apiRequest<ReportListResponse>(`${endpoint}?${queryParams.toString()}`),
  });

  const rows = data?.rows ?? [];
  const totalPages = data?.pagination?.totalPages ?? 1;
  const total = data?.total ?? 0;
  const filterSummary = [
    from ? `From: ${from}` : null,
    to ? `To: ${to}` : null,
    gender ? `Gender: ${gender}` : null,
    region ? `Region: ${region}` : null,
    district ? `District: ${district}` : null,
    town ? `Town: ${town}` : null,
    area ? `Area: ${area}` : null,
    reportType === "opd-visits" && newReturning ? `Visit type: ${newReturning}` : null,
  ].filter((filter): filter is string => filter !== null).join(" • ") || "All records";

  const resetFilters = () => {
    setFrom("");
    setTo("");
    setGender("");
    setRegion("");
    setDistrict("");
    setTown("");
    setArea("");
    setNewReturning("");
    setPage(1);
  };

  const openFieldSelection = (action: SelectionAction) => {
    setDraftFields(reportFields.map((field) => field.key));
    setSelectionAction(action);
  };

  const handleExportExcel = (fields: ReportField[]) => {
    if (!total || isExporting) {
      return;
    }

    setIsExporting(true);
    setExportStatus(null);

    void (async () => {
      try {
        const ExcelJS = (await import("exceljs")).default;
        const allRows = await fetchAllReportRows(endpoint, queryParams);
        const headers = reportFields
          .filter((field) => fields.includes(field.key))
          .map((field) => field.label);
        const exportRows = allRows.map((row) =>
          fields.map((field) => formatExportValue(getReportFieldValue(row, reportType, field)))
        );
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet(
          reportType === "patients" ? "Patient registrations" : "OPD visits"
        );
        worksheet.columns = headers.map((header, index) => ({
          header,
          width: Math.min(
            Math.max(
              12,
              ...exportRows.map((row) => String(row[index] ?? "").length),
              header.length
            ) + 2,
            40
          ),
        }));
        worksheet.getRow(1).font = { bold: true };
        exportRows.forEach((row) => worksheet.addRow(row));
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        const now = new Date();
        const dateStamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
        link.href = url;
        link.download = `odoben-health-center_${reportType === "patients" ? "patient-registration" : "opd-visit"}_report_${dateStamp}.xlsx`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        setExportStatus(`Exported ${allRows.length} rows.`);
      } catch {
        setExportStatus("Excel export failed. Please try again.");
      } finally {
        setIsExporting(false);
      }
    })();
  };

  const confirmFieldSelection = () => {
    if (draftFields.length === 0 || !selectionAction) return;

    const selectedFields = reportFields
      .map((field) => field.key)
      .filter((field) => draftFields.includes(field));

    if (selectionAction === "excel") {
      setSelectionAction(null);
      handleExportExcel(selectedFields);
      return;
    }

    setPrintFields(selectedFields);
    setSelectionAction(null);
    window.setTimeout(() => window.print(), 0);
  };

  return (
    <div className="print-report space-y-8 print:space-y-4">
      <Dialog.Root open={selectionAction !== null} onOpenChange={(open) => {
        if (!open) setSelectionAction(null);
      }}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-[100] bg-foreground/40 backdrop-blur-sm print:hidden" />
          <Dialog.Popup className="fixed left-1/2 top-1/2 z-[101] max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-border bg-card p-6 text-card-foreground shadow-xl outline-none print:hidden">
            <Dialog.Title className="text-lg font-semibold text-foreground">
              Choose fields to {selectionAction === "excel" ? "export" : "print"}
            </Dialog.Title>
            <Dialog.Description className="mt-2 text-sm leading-6 text-muted-foreground">
              Select the report columns to include. {selectionAction === "excel"
                ? "The Excel workbook will contain all rows matching the current filters."
                : "The printed report will include the current page and selected columns."}
            </Dialog.Description>

            <div className="mt-5 space-y-3">
              <label className="flex min-h-10 cursor-pointer items-center gap-3 rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground">
                <input
                  type="checkbox"
                  checked={draftFields.length === reportFields.length}
                  onChange={(event) => setDraftFields(event.target.checked ? reportFields.map((field) => field.key) : [])}
                  className="h-4 w-4 accent-primary"
                />
                Select all fields
              </label>
              <div className="grid gap-2 sm:grid-cols-2">
                {reportFields.map((field) => (
                  <label key={field.key} className="flex min-h-10 cursor-pointer items-center gap-3 rounded-md border border-border px-3 py-2 text-sm text-foreground">
                    <input
                      type="checkbox"
                      checked={draftFields.includes(field.key)}
                      onChange={(event) => setDraftFields((current) =>
                        event.target.checked
                          ? [...current, field.key]
                          : current.filter((selected) => selected !== field.key)
                      )}
                      className="h-4 w-4 accent-primary"
                    />
                    {field.label}
                  </label>
                ))}
              </div>
            </div>

            {draftFields.length === 0 ? (
              <p className="mt-3 text-sm text-destructive" role="alert">Select at least one field to continue.</p>
            ) : null}

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" onClick={() => setSelectionAction(null)}>Cancel</Button>
              <Button type="button" disabled={draftFields.length === 0 || (selectionAction === "excel" && isExporting)} onClick={confirmFieldSelection}>
                {selectionAction === "excel" ? "Export Excel" : "Print report"}
              </Button>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>

      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Reports</p>
          <h2 className="mt-2 text-3xl font-semibold text-foreground">Patient and OPD reports</h2>
        </div>

        <div className="flex flex-wrap gap-2 print:hidden">
          <Button type="button" variant={reportType === "patients" ? "default" : "secondary"} onClick={() => setReportType("patients")}>Patients</Button>
          <Button type="button" variant={reportType === "opd-visits" ? "default" : "secondary"} onClick={() => setReportType("opd-visits")}>OPD visits</Button>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm print:hidden">
        <div className="mb-4 flex items-center gap-2 text-primary">
          <Filter className="h-4 w-4" />
          <span className="text-sm font-medium">Filters</span>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">From</label>
            <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">To</label>
            <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Gender</label>
            <select value={gender} onChange={(event) => setGender(event.target.value)} className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
              <option value="">All</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Area</label>
            <Input value={area} onChange={(event) => setArea(event.target.value)} placeholder="All areas" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Region</label>
            <Input value={region} onChange={(event) => setRegion(event.target.value)} placeholder="All regions" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">District</label>
            <Input value={district} onChange={(event) => setDistrict(event.target.value)} placeholder="All districts" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Town</label>
            <Input value={town} onChange={(event) => setTown(event.target.value)} placeholder="All towns" />
          </div>
          {reportType === "opd-visits" ? (
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">New/Returning</label>
              <select value={newReturning} onChange={(event) => setNewReturning(event.target.value)} className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
                <option value="">All</option>
                <option value="new">New</option>
                <option value="returning">Returning</option>
              </select>
            </div>
          ) : null}
        </div>

        <div className="mt-5 flex flex-wrap justify-end gap-3">
          <Button type="button" variant="secondary" onClick={resetFilters}>Reset</Button>
          <Button type="button" variant="secondary" onClick={() => setPage(1)}>Apply</Button>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm print:border-0 print:p-0 print:shadow-none">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:mb-2">
          <div>
            <h3 className="text-xl font-semibold text-foreground">{reportType === "patients" ? "Patient registration report" : "OPD visit report"}</h3>
            <p className="text-sm text-muted-foreground">{total} matching rows</p>
          </div>

          <div className="flex gap-2 print:hidden">
            <Button type="button" variant="secondary" onClick={() => openFieldSelection("excel")} disabled={isLoading || isExporting || total === 0}>
              <Download className="mr-2 h-4 w-4" />{isExporting ? "Exporting..." : "Export Excel"}
            </Button>
            <Button type="button" variant="secondary" onClick={() => openFieldSelection("print")} disabled={isLoading || rows.length === 0}>
              <Printer className="mr-2 h-4 w-4" />Print report
            </Button>
          </div>
        </div>

        <div className="mb-4 hidden text-sm text-foreground print:block">
          <p className="font-semibold">ODOBEN HEALTH CENTER</p>
          <p>{filterSummary} · Page {page} of {totalPages}</p>
        </div>

        {exportStatus ? (
          <div className="mb-4 print:hidden">
            <FeedbackMessage
              message={exportStatus}
              kind={exportStatus.includes("failed") ? "error" : "success"}
              onDismiss={() => setExportStatus(null)}
            />
          </div>
        ) : null}

        {error ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">Unable to load report.</div>
        ) : null}

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((item) => (
              <div key={item} className="h-14 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No rows match the current filters.
          </div>
        ) : (
          <div className="overflow-x-auto print:hidden">
            <table className="min-w-full text-left text-sm print:w-full print:text-xs">
              <thead>
                <tr className="border-b border-border text-foreground">
                  {visibleFields.map((field) => <th key={field.key} className="px-3 py-3 font-semibold">{field.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={`${row.patientId}-${row.date}-${row.name}`} className="border-b border-border last:border-0">
                    {visibleFields.map((field) => (
                      <td key={field.key} className={`px-3 py-3 text-foreground ${field.key === "gender" || field.key === "newReturning" ? "capitalize" : ""}`}>
                        {getReportFieldValue(row, reportType, field.key) ?? "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!isLoading && rows.length > 0 ? (
          <div className="hidden print:block">
            <table className="min-w-full text-left text-xs print:w-full">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  {printFields.map((field) => (
                    <th key={field} className="px-3 py-3 font-semibold text-foreground">
                      {reportFields.find((option) => option.key === field)?.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={`${row.patientId}-${row.date}-${row.name}-print`} className="border-b border-border last:border-0">
                    {printFields.map((field) => (
                      <td key={field} className={`px-3 py-3 text-foreground ${field === "gender" || field === "newReturning" ? "capitalize" : ""}`}>
                        {formatExportValue(getReportFieldValue(row, reportType, field))}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {rows.length > 0 ? (
          <div className="mt-5 flex items-center justify-between gap-3 text-sm text-muted-foreground print:hidden">
            <span>Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</Button>
              <Button type="button" variant="secondary" disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>Next</Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
