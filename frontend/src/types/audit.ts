export type AuditActor = {
  id: string;
  firstName: string;
  lastName: string;
};

export type AuditLog = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  actor?: AuditActor | null;
};

export type AuditLogsResponse = {
  logs: AuditLog[];
  pagination?: {
    total?: number;
    page?: number;
    limit?: number;
    totalPages?: number;
  };
};
