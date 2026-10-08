import { PatientController } from "@/modules/patient/patient.controller";
import { customResponse } from "@/lib/http/response";
import { SuccessCodes } from "@/lib/http/successCodes";
import { handleError } from "@/lib/errors/globalError";
import { withAuth, AuthedHandler } from "@/middleware/withAuth";
import { CustomAppError } from "@/lib/errors/customAppError";
import { ErrorCodes } from "@/lib/errors/errorCodes";
import { UserRole } from "@/database/entities/User";
import { parseUpdatePatientRequest } from "@/modules/patient/patient.request";

type RouteContext = { params: Promise<{ id: string }> };

// NOTE: this file previously called UserController (a leftover
// copy/paste from the users/[id] route) instead of PatientController —
// GET/PATCH on a single patient were silently operating on the *user*
// table instead, using the patient id as if it were a user id. Fixed to
// use PatientController, and locked to the same roles as the rest of
// the patient endpoints (there is no "self access" concept for patients
// the way there is for users).

const getHandler: AuthedHandler = async (req, ctx) => {
  try {
    if (!ctx?.params) throw new CustomAppError("Missing route parameters", 400, ErrorCodes.ID_REQUIRED.code, ErrorCodes.ID_REQUIRED.label, "bad_request");

    const { id } = await (ctx.params as unknown as RouteContext["params"]);
    const patient = await PatientController.getPatient(id);
    return customResponse(SuccessCodes.RECORD_FETCHED.code, SuccessCodes.RECORD_FETCHED.message, 200, patient);
  } catch (error) {
    return handleError(error);
  }
};


const patchHandler: AuthedHandler = async (req, ctx) => {
  try {
    if (!ctx?.params) throw new CustomAppError("Missing route parameters", 400, ErrorCodes.ID_REQUIRED.code, ErrorCodes.ID_REQUIRED.label, "bad_request");

    const { id } = await (ctx.params as unknown as RouteContext["params"]);
    const { data, image } = await parseUpdatePatientRequest(req);
    const patient = await PatientController.updatePatient(id, data, req.user.sub, image);
    return customResponse(SuccessCodes.RECORD_UPDATED.code, SuccessCodes.RECORD_UPDATED.message, 200, patient);
  } catch (error) {
    return handleError(error);
  }
};

export const GET = withAuth(getHandler, { requireRole: [UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.RECEPTIONIST] });
export const PATCH = withAuth(patchHandler, { requireRole: [UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.RECEPTIONIST] });
