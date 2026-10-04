import { AuditLogService, type ListAuditLogsParams } from "./auditLog.service";
import type { UserRole } from "@/database/entities/User";

export class AuditLogController {
  static async getLogs(data: ListAuditLogsParams, viewerRole: UserRole) {
    return await AuditLogService.list(data, viewerRole);
  }
}