import { AppDataSource } from "@/database/data-source";
import { AuditLog } from "@/database/entities/AuditLog";
import { FilterAuditLogDTO } from "@/types/auditLog.type";
import { PaginationQuery } from "@/types/pagination.type";
import { buildPaginationMeta, parsePagination } from "@/lib/http/pagination";

// Admin-facing review of the audit trail (spec section 9: "review the
// existing implementation"). Read-only, filterable list — no export,
// no formatting logic; that belongs in the frontend, same as reports.
export class AuditLogService {
  private static async repo() {
    const db = await AppDataSource();
    return db.getRepository(AuditLog);
  }

  static async list(filters: FilterAuditLogDTO & PaginationQuery & { from?: string; to?: string }) {
    const repo = await this.repo();
    const query = repo
      .createQueryBuilder("log")
      .leftJoin("log.actor", "actor")
      // name only: no passwordHash, and no role, so super_admin actors are not identifiable by role
      .addSelect(["actor.id", "actor.firstName", "actor.lastName"]);

    if (filters.actorUserId) {
      query.andWhere("actor.id = :actorUserId", { actorUserId: filters.actorUserId });
    }
    if (filters.action) {
      query.andWhere("log.action = :action", { action: filters.action });
    }
    if (filters.entityType) {
      query.andWhere("log.entityType = :entityType", { entityType: filters.entityType });
    }
    if (filters.entityId) {
      query.andWhere("log.entityId = :entityId", { entityId: filters.entityId });
    }
    if (filters.from) {
      query.andWhere("log.createdAt >= :from", { from: filters.from });
    }
    if (filters.to) {
      query.andWhere("log.createdAt < (CAST(:to AS date) + INTERVAL '1 day')", { to: filters.to });
    }

    const { page, limit, skip, take } = parsePagination({
      page: filters.page?.toString(),
      limit: filters.limit?.toString(),
    });

    const [logs, count] = await query
      .orderBy("log.createdAt", "DESC")
      .skip(skip)
      .take(take)
      .getManyAndCount();

    return { logs, pagination: buildPaginationMeta(count, page, limit) };
  }
}
