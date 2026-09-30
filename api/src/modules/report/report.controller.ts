import { ReportService } from "./report.service";
import type { OPDVisitReportFilter, ReportDateRangeFilter } from "@/types/report.type";
import type { PaginationQuery } from "@/types/pagination.type";

export class ReportController {
  static async patientRegistrationReport(filters: ReportDateRangeFilter & PaginationQuery) {
    return await ReportService.patientRegistrationReport(filters);
  }

  static async opdVisitReport(filters: OPDVisitReportFilter & PaginationQuery) {
    return await ReportService.opdVisitReport(filters);
  }
}
