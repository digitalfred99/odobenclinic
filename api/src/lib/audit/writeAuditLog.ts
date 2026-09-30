import type { EntityManager } from "typeorm";
import { AppDataSource } from "@/database/data-source";
import { AuditLog } from "@/database/entities/AuditLog";
import type { AuditActionType, AuditEntityTypeValue } from "./auditActions";

export interface WriteAuditLogInput {
  actorUserId?: string;
  action: AuditActionType;
  entityType: AuditEntityTypeValue;
  entityId?: string;
  ipAddress?: string;
  userAgent?: string;
  // Never pass secrets here (passwords, tokens, JWTs) — see section 16 of
  // the spec. Callers are responsible for only including safe, relevant
  // context (e.g. previous/next status, admin note).
  metadata?: Record<string, unknown>;
}

/**
 * Writes one audit log row. Pass `manager` to write inside an existing
 * db.transaction() so the audit record commits/rolls back atomically with
 * the business change it documents (e.g. patient registration + audit
 * log succeed or fail together). Without `manager`, writes standalone.
 */
export async function writeAuditLog(input: WriteAuditLogInput, manager?: EntityManager) {
  const repo = manager ? manager.getRepository(AuditLog) : (await AppDataSource()).getRepository(AuditLog);

  const entry = repo.create({
    actor: input.actorUserId ? ({ id: input.actorUserId } as never) : undefined,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    metadata: input.metadata,
  });

  // Audit logging must never block or fail the primary operation when
  // written standalone (post-commit, e.g. after a review action outside
  // the main transaction). Inside a transaction (manager passed), let it
  // throw normally so a broken audit write rolls back with everything else.
  if (manager) {
    await repo.save(entry);
  } else {
    await repo.save(entry).catch((err) => {
      console.error("Failed to write audit log", { action: input.action, err });
    });
  }
}
