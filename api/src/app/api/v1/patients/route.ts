import { NextRequest } from "next/server";
import { PatientController } from "@/modules/patient/patient.controller";
import { customResponse } from "@/lib/http/response";
import { SuccessCodes } from "@/lib/http/successCodes";
import { handleError } from "@/lib/errors/globalError";
import { withAuth, AuthedHandler } from "@/middleware/withAuth";
import { FilterPatientDTO } from "@/types/patient.type";
import { PaginationQuery } from "@/types/pagination.type";
import { UserRole } from "@/database/entities/User";
import { parseCreatePatientRequest } from "@/modules/patient/patient.request";

// Get list of patients with optional filters — admin/receptionist
const getHandler: AuthedHandler = async (req, _ctx) => {
    try {
        const params = req.nextUrl.searchParams;
        const filters: FilterPatientDTO & PaginationQuery = {
            search: params.get("search") ?? undefined,
            gender: (params.get("gender") as FilterPatientDTO["gender"]) ?? undefined,
            maritalStatus: (params.get("maritalStatus") as FilterPatientDTO["maritalStatus"]) ?? undefined,
            region: params.get("region") ?? undefined,
            district: params.get("district") ?? undefined,
            town: params.get("town") ?? undefined,
            area: params.get("area") ?? undefined,
            patientId: params.get("patientId") ?? undefined,
            page: params.get("page") ? Number(params.get("page")) : undefined,
            limit: params.get("limit") ? Number(params.get("limit")) : undefined,
        };

        const patients = await PatientController.getPatients(filters);
        return customResponse(SuccessCodes.RECORD_FETCHED.code, SuccessCodes.RECORD_FETCHED.message, 200, patients);

    } catch (error) {
        return handleError(error)
    }
}

// Create a new patient — admin/receptionist. The receptionist/admin
// making the request is threaded through as both the audit-trail actor
// and Patient.createdBy (who permanently registered this patient).
const postHandler: AuthedHandler = async (req, _ctx) => {
    try {
        const { data, image } = await parseCreatePatientRequest(req);
        const patient = await PatientController.createPatient(data, req.user.sub, image);
        return customResponse(SuccessCodes.RECORD_CREATED.code, SuccessCodes.RECORD_CREATED.message, 201, patient);
    } catch (error) {
        return handleError(error)
    }
}

// Delete (soft) patients by IDs — admin/receptionist
const deleteHandler: AuthedHandler = async (req, _ctx) => {
    try {
        const data = await req.json();
        const patients = await PatientController.deletePatients(data.ids, req.user.sub);
        return customResponse(SuccessCodes.RECORD_DELETED.code, SuccessCodes.RECORD_DELETED.message, 200, patients);
    } catch (error) {
        return handleError(error)
    }
}

export const GET    = withAuth(getHandler, { requireRole: [UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.RECEPTIONIST] })
export const POST   = withAuth(postHandler, { requireRole: [UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.RECEPTIONIST] })
export const DELETE = withAuth(deleteHandler, { requireRole: [UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.RECEPTIONIST] })