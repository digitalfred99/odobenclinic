"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Filter, Printer } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { serializeCsv } from "@/lib/export/csv";
import { Button } from "@/components/ui/button";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { Input } from "@/components/ui/input";
import type { ReportListResponse, ReportRow } from "@/types/report";

const REPORT_LIMIT = 20;
const EXPORT_LIMIT = 100;
const EXPORT_BATCH_SIZE = 4;

type ReportType = "patients" | "opd-visits";

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

  const handleExportCsv = () => {
    if (!total || isExporting) {
      return;
    }

    setIsExporting(true);
    setExportStatus(null);

    void (async () => {
      try {
        const allRows = await fetchAllReportRows(endpoint, queryParams);
        const headers = [
          "OPD No.",
          "Name",
          "Age",
          "Gender",
          "Area",
          reportType === "patients" ? "Date registered" : "Visit date",
          ...(reportType === "opd-visits" ? ["New/Returning"] : []),
        ];
        const csvRows = allRows.map((row) => [
          row.patientId,
          row.name,
          row.age,
          row.gender,
          row.area,
          reportType === "patients" ? (row.dateRegistered ?? row.date) : row.date,
          ...(reportType === "opd-visits" ? [row.newReturning] : []),
        ]);
        const csv = serializeCsv([headers, ...csvRows]);
        const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        const now = new Date();
        const dateStamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
        link.href = url;
        link.download = `odoben-health-center_${reportType === "patients" ? "patient-registration" : "opd-visit"}_report_${dateStamp}.csv`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        setExportStatus(`Exported ${allRows.length} rows.`);
      } catch {
        setExportStatus("CSV export failed. Please try again.");
      } finally {
        setIsExporting(false);
      }
    })();
  };

  const handlePrint = () => window.print();

  return (
    <div className="print-report space-y-8 print:space-y-4">
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
            <Button type="button" variant="secondary" onClick={handleExportCsv} disabled={isLoading || isExporting || total === 0}>
              <Download className="mr-2 h-4 w-4" />{isExporting ? "Exporting..." : "Export CSV"}
            </Button>
            <Button type="button" variant="secondary" onClick={handlePrint} disabled={isLoading || rows.length === 0}>
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
          <div className="overflow-x-auto print:overflow-visible">
            <table className="min-w-full text-left text-sm print:w-full print:text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="px-3 py-3 font-medium">OPD No.</th>
                  <th className="px-3 py-3 font-medium">Name</th>
                  <th className="px-3 py-3 font-medium">Age</th>
                  <th className="px-3 py-3 font-medium">Gender</th>
                  <th className="px-3 py-3 font-medium">Area</th>
                  <th className="px-3 py-3 font-medium">{reportType === "patients" ? "Date registered" : "Visit date"}</th>
                  {reportType === "opd-visits" ? <th className="px-3 py-3 font-medium">New/Returning</th> : null}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={`${row.patientId}-${row.date}-${row.name}`} className="border-b border-border last:border-0">
                    <td className="px-3 py-3 font-medium text-foreground">{row.patientId}</td>
                    <td className="px-3 py-3 text-foreground">{row.name}</td>
                    <td className="px-3 py-3 text-foreground">{row.age ?? "—"}</td>
                    <td className="px-3 py-3 text-foreground capitalize">{row.gender}</td>
                    <td className="px-3 py-3 text-foreground">{row.area ?? "—"}</td>
                    <td className="px-3 py-3 text-foreground">{reportType === "patients" ? (row.dateRegistered ?? row.date) : row.date}</td>
                    {reportType === "opd-visits" ? <td className="px-3 py-3 text-foreground capitalize">{row.newReturning ?? "—"}</td> : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

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
