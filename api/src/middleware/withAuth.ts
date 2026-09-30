import { NextRequest } from "next/server";
import { verifyAccessToken, AccessTokenPayload } from "@/lib/jwt";
import { CustomAppError } from "@/lib/errors/customAppError";
import { ErrorCodes } from "@/lib/errors/errorCodes";
import { handleError } from "@/lib/errors/globalError";
import type { UserRole } from "@/database/entities/User";

export interface AuthedRequest extends NextRequest {
  user: AccessTokenPayload; // { sub: userId, role, type: "access" }
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

      if (options.requireRole) {
        const allowedRoles = Array.isArray(options.requireRole)
          ? options.requireRole
          : [options.requireRole];

        if (!allowedRoles.includes(payload.role)) {
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
      authedReq.user = payload;

      return await handler(authedReq, context);
    } catch (error) {
      return handleError(error);
    }
  };
}