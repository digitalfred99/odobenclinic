import { ReportController } from "@/modules/report/report.controller";
import { customResponse } from "@/lib/http/response";
import { SuccessCodes } from "@/lib/http/successCodes";
import { handleError } from "@/lib/errors/globalError";
import { withAuth, AuthedHandler } from "@/middleware/withAuth";
import { UserRole } from "@/database/entities/User";
import { Gender } from "@/database/entities/Patient";

const getHandler: AuthedHandler = async (req, _ctx) => {
  try {
    const params = req.nextUrl.searchParams;
    const report = await ReportController.patientRegistrationReport({
      from: params.get("from") ?? undefined,
      to: params.get("to") ?? undefined,
      gender: (params.get("gender") as Gender) ?? undefined,
      region: params.get("region") ?? undefined,
      district: params.get("district") ?? undefined,
      town: params.get("town") ?? undefined,
      area: params.get("area") ?? undefined,
      page: params.get("page") ? Number(params.get("page")) : undefined,
      limit: params.get("limit") ? Number(params.get("limit")) : undefined,
    });
    return customResponse(SuccessCodes.RECORD_FETCHED.code, SuccessCodes.RECORD_FETCHED.message, 200, report);
  } catch (error) {
    return handleError(error);
  }
};

export const GET = withAuth(getHandler, { requireRole: [UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.RECEPTIONIST] });
