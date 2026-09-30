import { NextRequest } from "next/server";
import { OPDVisitController } from "@/modules/opdVisit/opdVisit.controller";
import { customResponse } from "@/lib/http/response";
import { SuccessCodes } from "@/lib/http/successCodes";
import { handleError } from "@/lib/errors/globalError";
import { withAuth, AuthedHandler } from "@/middleware/withAuth";
import { CustomAppError } from "@/lib/errors/customAppError";
import { ErrorCodes } from "@/lib/errors/errorCodes";
import { UserRole } from "@/database/entities/User";

type RouteContext = { params: Promise<{ id: string }> };

const getHandler: AuthedHandler = async (req, ctx) => {
  try {
    if (!ctx?.params) throw new CustomAppError( "Missing route parameters", 400, ErrorCodes.ID_REQUIRED.code, ErrorCodes.ID_REQUIRED.label, "bad_request" );

    const { id } = await (ctx.params as unknown as RouteContext["params"]);
    const opdVisit = await OPDVisitController.getOPDVisit(id);
    return customResponse(SuccessCodes.RECORD_FETCHED.code, SuccessCodes.RECORD_FETCHED.message, 200, opdVisit);
  } catch (error) {
    return handleError(error);
  }
};

const patchHandler: AuthedHandler = async (req, ctx) => {
  try {
    if (!ctx?.params) throw new CustomAppError( "Missing route parameters", 400, ErrorCodes.ID_REQUIRED.code, ErrorCodes.ID_REQUIRED.label, "bad_request" );

    const data = await req.json();
    const { id } = await (ctx.params as unknown as RouteContext["params"]);
    const opdVisit = await OPDVisitController.updateOPDVisit(id, data, req.user.sub);
    return customResponse(SuccessCodes.RECORD_UPDATED.code, SuccessCodes.RECORD_UPDATED.message, 200, opdVisit);
  } catch (error) {
    return handleError(error);
  }
};

// Previously had no role restriction at all (any authenticated user).
// Locked to the same roles as the rest of the OPD endpoints for
// defense-in-depth/consistency.
export const GET = withAuth(getHandler, { requireRole: [UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.RECEPTIONIST] });
export const PATCH = withAuth(patchHandler, { requireRole: [UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.RECEPTIONIST] });