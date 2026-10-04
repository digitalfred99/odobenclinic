import { AuditLogController } from "@/modules/auditLog/auditLog.controller";
import { customResponse } from "@/lib/http/response";
import { SuccessCodes } from "@/lib/http/successCodes";
import { handleError } from "@/lib/errors/globalError";
import { withAuth, AuthedHandler } from "@/middleware/withAuth";
import { UserRole } from "@/database/entities/User";

// Admin-tier only — the audit trail itself is sensitive (who did what,
// when, from which IP) and is not something a receptionist needs.
// Super admin activity is further restricted to super admins only
// (enforced in AuditLogService.list based on the viewer's role).
const getHandler: AuthedHandler = async (req) => {
  try {
    const params = req.nextUrl.searchParams;
    const logs = await AuditLogController.getLogs(
      {
        actorUserId: params.get("actorUserId") ?? undefined,
        action: params.get("action") ?? undefined,
        entityType: params.get("entityType") ?? undefined,
        entityId: params.get("entityId") ?? undefined,
        from: params.get("from") ?? undefined,
        to: params.get("to") ?? undefined,
        page: params.get("page") ? Number(params.get("page")) : undefined,
        limit: params.get("limit") ? Number(params.get("limit")) : undefined,
      },
      // Role from the verified JWT payload set by withAuth, never from the request params.
      req.user.role,
    );
    return customResponse(SuccessCodes.RECORD_FETCHED.code, SuccessCodes.RECORD_FETCHED.message, 200, logs);
  } catch (error) {
    return handleError(error);
  }
};

export const GET = withAuth(getHandler, { requireRole: [UserRole.ADMIN, UserRole.SUPER_ADMIN] });