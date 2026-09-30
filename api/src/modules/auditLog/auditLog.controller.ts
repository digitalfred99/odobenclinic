import { AuditLogService } from "./auditLog.service";
import type { FilterAuditLogDTO } from "@/types/auditLog.type";
import type { PaginationQuery } from "@/types/pagination.type";

export class AuditLogController {
  static async getLogs(data: FilterAuditLogDTO & PaginationQuery & { from?: string; to?: string }) {
    return await AuditLogService.list(data);
  }
}
