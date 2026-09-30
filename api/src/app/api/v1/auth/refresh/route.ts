// POST /api/v1/auth/refresh
// Body: { refreshToken }
// Returns: { accessToken, refreshToken }  (refresh token is rotated)
import { NextRequest } from "next/server";
import { AuthController } from "@/modules/auth/auth.controller";
import { ok, handleError } from "@/lib/errors/globalError";

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    return ok(await AuthController.refresh(data));
  } catch (err) {
    return handleError(err);
  }
}
