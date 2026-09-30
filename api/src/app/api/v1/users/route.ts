import { NextRequest } from "next/server";
import { UserController } from "@/modules/user/user.controller";
import { customResponse } from "@/lib/http/response";
import { SuccessCodes } from "@/lib/http/successCodes";
import { handleError } from "@/lib/errors/globalError";
import { withAuth, AuthedHandler } from "@/middleware/withAuth";
import { FilterUserDTO } from "@/types/user.type";
import { PaginationQuery } from "@/types/pagination.type";
import { UserRole } from "@/database/entities/User";

// Get list of users with optional filters — admin only
const getHandler: AuthedHandler = async (req, _ctx) => {
    try {
        const params = req.nextUrl.searchParams;
        const filters: FilterUserDTO & PaginationQuery = {
            search: params.get("search") ?? undefined,
            role: (params.get("role") as FilterUserDTO["role"]) ?? undefined,
            isActive: params.has("isActive") ? params.get("isActive") === "true" : undefined,
            page: params.get("page") ? Number(params.get("page")) : undefined,
            limit: params.get("limit") ? Number(params.get("limit")) : undefined,
        };

        const users = await UserController.getUsers(filters);
        return customResponse(SuccessCodes.RECORD_FETCHED.code, SuccessCodes.RECORD_FETCHED.message, 200, users);

    } catch (error) {
        return handleError(error)
    }
}

// Create a new user — admin/super_admin (role field itself is further
// gated inside UserService.create: only super_admin may set admin/super_admin)
const postHandler: AuthedHandler = async (req, _ctx) => {
    try {
        const data = await req.json();
        const user = await UserController.createUser(data, { id: req.user.sub, role: req.user.role });
        return customResponse(SuccessCodes.RECORD_CREATED.code, SuccessCodes.RECORD_CREATED.message, 201, user);
    } catch (error) {
        return handleError(error)
    }
}

// Delete users by IDs — admin/super_admin (admin cannot delete another
// admin/super_admin account, enforced inside UserService.delete)
const deleteHandler: AuthedHandler = async (req, _ctx) => {
    try {
        const data = await req.json();
        await UserController.deleteUsers(data.ids, { id: req.user.sub, role: req.user.role });
        return customResponse(SuccessCodes.RECORD_DELETED.code, SuccessCodes.RECORD_DELETED.message, 200);
    } catch (error) {
        return handleError(error)
    }
}

export const GET    = withAuth(getHandler, { requireRole: [UserRole.ADMIN, UserRole.SUPER_ADMIN] })
export const POST   = withAuth(postHandler, { requireRole: [UserRole.ADMIN, UserRole.SUPER_ADMIN] })
export const DELETE = withAuth(deleteHandler, { requireRole: [UserRole.ADMIN, UserRole.SUPER_ADMIN] })