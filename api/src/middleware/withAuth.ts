import { NextRequest } from "next/server";
import { verifyAccessToken, AccessTokenPayload } from "@/lib/jwt";
import { CustomAppError } from "@/lib/errors/customAppError";
import { ErrorCodes } from "@/lib/errors/errorCodes";
import { handleError } from "@/lib/errors/globalError";
import { AppDataSource } from "@/database/data-source";
import { User, type UserRole } from "@/database/entities/User";

export interface AuthedRequest extends NextRequest {
  user: AccessTokenPayload; // { sub, role, type: "access", tv }
}

export type AuthedHandler = (
  req: AuthedRequest,
  context?: { params: Promise<Record<string, string>> }
) => Promise<Response> | Response;

interface WithAuthOptions {
  requireRole?: UserRole | UserRole[];
}

export function withAuth(handler: AuthedHandler, options: WithAuthOptions = {}) {
  return async (req: NextRequest, context?: { params: Promise<Record<string, string>> }) => {
    try {
      const authHeader = req.headers.get("authorization");

      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        throw new CustomAppError(
          "Authentication required",
          401,
          ErrorCodes.UNAUTHORIZED_ACCESS.code,
          ErrorCodes.UNAUTHORIZED_ACCESS.label,
          "unauthorized"
        );
      }

      const token = authHeader.slice(7);

      let payload: AccessTokenPayload;
      try {
        payload = verifyAccessToken(token);
      } catch {
        throw new CustomAppError(
          "Invalid or expired token",
          401,
          ErrorCodes.INVALID_TOKEN.code,
          ErrorCodes.INVALID_TOKEN.label,
          "invalid_token"
        );
      }

      // Load the user on every request so deletion, deactivation, role
      // changes and password changes take effect immediately instead of
      // waiting for the access token to expire.
      const db = await AppDataSource();
      const user = await db.getRepository(User).findOne({
        where: { id: payload.sub, isDeleted: false, isActive: true },
        select: { id: true, role: true, tokenVersion: true },
      });

      if (!user || (payload.tv ?? 0) !== user.tokenVersion) {
        throw new CustomAppError(
          "This session is no longer valid",
          401,
          ErrorCodes.UNAUTHORIZED_ACCESS.code,
          ErrorCodes.UNAUTHORIZED_ACCESS.label,
          "unauthorized"
        );
      }

      if (options.requireRole) {
        const allowedRoles = Array.isArray(options.requireRole)
          ? options.requireRole
          : [options.requireRole];

        // Role comes from the DB, not the token, so demotions apply immediately.
        if (!allowedRoles.includes(user.role)) {
          throw new CustomAppError(
            "You do not have permission to perform this action",
            403,
            ErrorCodes.PERMISSION_DENIED.code,
            ErrorCodes.PERMISSION_DENIED.label,
            "forbidden"
          );
        }
      }

      const authedReq = req as AuthedRequest;
      authedReq.user = { ...payload, role: user.role };

      return await handler(authedReq, context);
    } catch (error) {
      return handleError(error);
    }
  };
}