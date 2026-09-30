// POST /api/v1/auth/logout  (Bearer token required)
// Audit-only: records the sign-out. Does not revoke the JWT; the client discards its tokens.
import { AuthController } from "@/modules/auth/auth.controller";
import { customResponse } from "@/lib/http/response";
import { SuccessCodes } from "@/lib/http/successCodes";
import { handleError } from "@/lib/errors/globalError";
import { withAuth, AuthedHandler } from "@/middleware/withAuth";

const postHandler: AuthedHandler = async (req, _ctx) => {
  try {
    const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined;
    const userAgent = req.headers.get("user-agent") ?? undefined;
    await AuthController.logout(req.user.sub, { ipAddress, userAgent });
    return customResponse(SuccessCodes.RECORD_UPDATED.code, SuccessCodes.RECORD_UPDATED.message, 200);
  } catch (error) {
    return handleError(error);
  }
};

export const POST = withAuth(postHandler);
