import { PatientWithOpdController } from "@/modules/patientWithOpd/patientWithOpd.controller";
import { customResponse } from "@/lib/http/response";
import { SuccessCodes } from "@/lib/http/successCodes";
import { handleError } from "@/lib/errors/globalError";
import { withAuth, AuthedHandler } from "@/middleware/withAuth";
import { UserRole } from "@/database/entities/User";

// Register a patient together with their first OPD visit in one request —
// admin/receptionist. Body: { patient, opdVisit? }. Both are saved in a
// single transaction: if either fails, neither is saved.
const postHandler: AuthedHandler = async (req, _ctx) => {
    try {
        const data = await req.json();
        const result = await PatientWithOpdController.createPatientWithOpd(data, req.user.sub);
        return customResponse(SuccessCodes.RECORD_CREATED.code, SuccessCodes.RECORD_CREATED.message, 201, result);
    } catch (error) {
        return handleError(error)
    }
}

export const POST = withAuth(postHandler, { requireRole: [UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.RECEPTIONIST] })