import { NextRequest } from "next/server";
import { OPDVisitController } from "@/modules/opdVisit/opdVisit.controller";
import { customResponse } from "@/lib/http/response";
import { SuccessCodes } from "@/lib/http/successCodes";
import { handleError } from "@/lib/errors/globalError";
import { withAuth, AuthedHandler } from "@/middleware/withAuth";
import { FilterOPDVisitDTO } from "@/types/opdVisit.type";
import { PaginationQuery } from "@/types/pagination.type";
import { UserRole } from "@/database/entities/User";

// Get list of OPD visits with optional filters — admin/receptionist
const getHandler: AuthedHandler = async (req, _ctx) => {
    try {
        const params = req.nextUrl.searchParams;
        const filters: FilterOPDVisitDTO & PaginationQuery = {
            search: params.get("search") ?? undefined,
            dateFrom: params.get("dateFrom") ?? undefined,
            dateTo: params.get("dateTo") ?? undefined,
            patientId: params.get("patientId") ?? undefined,
            page: params.get("page") ? Number(params.get("page")) : undefined,
            limit: params.get("limit") ? Number(params.get("limit")) : undefined,
        };

        const opdVisits = await OPDVisitController.getOPDVisits(filters);
        return customResponse(SuccessCodes.RECORD_FETCHED.code, SuccessCodes.RECORD_FETCHED.message, 200, opdVisits);

    } catch (error) {
        return handleError(error)
    }
}

// Create a new OPD visit — admin/receptionist. createdBy always comes
// from the authenticated actor, never from the request body.
const postHandler: AuthedHandler = async (req, _ctx) => {
    try {
        const data = await req.json();
        const createdById = req.user.sub;
        const opdVisit = await OPDVisitController.createOPDVisit(data, createdById);
        return customResponse(SuccessCodes.RECORD_CREATED.code, SuccessCodes.RECORD_CREATED.message, 201, opdVisit);
    } catch (error) {
        return handleError(error)
    }
}

// Delete (soft) OPD visits by IDs — admin/receptionist
const deleteHandler: AuthedHandler = async (req, _ctx) => {
    try {
        const data = await req.json();
        const opdVisits = await OPDVisitController.deleteOPDVisits(data.ids, req.user.sub);
        return customResponse(SuccessCodes.RECORD_DELETED.code, SuccessCodes.RECORD_DELETED.message, 200, opdVisits);
    } catch (error) {
        return handleError(error)
    }
}

export const GET    = withAuth(getHandler, { requireRole: [UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.RECEPTIONIST] })
export const POST   = withAuth(postHandler, { requireRole: [UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.RECEPTIONIST] })
export const DELETE = withAuth(deleteHandler, { requireRole: [UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.RECEPTIONIST] })