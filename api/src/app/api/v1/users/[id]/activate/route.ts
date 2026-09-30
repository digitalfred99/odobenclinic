import { UserController } from "@/modules/user/user.controller";
import { customResponse } from "@/lib/http/response";
import { SuccessCodes } from "@/lib/http/successCodes";
import { handleError } from "@/lib/errors/globalError";
import { withAuth, AuthedHandler } from "@/middleware/withAuth";
import { CustomAppError } from "@/lib/errors/customAppError";
import { ErrorCodes } from "@/lib/errors/errorCodes";
import { UserRole } from "@/database/entities/User";

type RouteContext = { params: Promise<{ id: string }> };

// Counterpart to .../deactivate — brings a deactivated account back
// without recreating it (see UserService.activateUser).
const postHandler: AuthedHandler = async (req, ctx) => {
  try {
    if (!ctx?.params) throw new CustomAppError("Missing route parameters", 400, ErrorCodes.ID_REQUIRED.code, ErrorCodes.ID_REQUIRED.label, "bad_request");

    const { id } = await (ctx.params as unknown as RouteContext["params"]);
    const user = await UserController.activateUser(id, { id: req.user.sub, role: req.user.role });
    return customResponse(SuccessCodes.RECORD_UPDATED.code, SuccessCodes.RECORD_UPDATED.message, 200, user);
  } catch (error) {
    return handleError(error);
  }
};

export const POST = withAuth(postHandler, { requireRole: [UserRole.ADMIN, UserRole.SUPER_ADMIN] });
