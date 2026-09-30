// POST /api/auth/login
// Body: { phone, password }
// Returns: { accessToken, refreshToken, user }

import { NextRequest } from "next/server";
import { AuthController } from "@/modules/auth/auth.controller";
import { ok, handleError } from "@/lib/errors/globalError";

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();

    const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined;
    const userAgent = req.headers.get("user-agent") ?? undefined;

    const result = await AuthController.login(data, { ipAddress, userAgent });

    return ok(result);
  } catch (err) {
    return handleError(err);
  }
}
