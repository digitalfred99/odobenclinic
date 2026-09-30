import { NextResponse } from "next/server";
import { QueryFailedError } from "typeorm";
import { CustomAppError } from "./customAppError";

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function fail(message: string, status = 400, details?: unknown) {
  return NextResponse.json(
    { success: false, message, ...(details ? { details } : {}) },
    { status }
  );
}

export function handleError(err: unknown): NextResponse {
  // Always log server-side, regardless of environment.
  console.error(err);

  if (err instanceof CustomAppError) {
    return NextResponse.json(
      {
        success: false,
        message: err.message,
        code: err.errorCode,
        label: err.errorLabel,
        key: err.errorKey,
      },
      { status: err.statusCode }
    );
  }

  // Must come before the generic `Error` check below, since
  // QueryFailedError extends Error.
  if (err instanceof QueryFailedError) {
    const pgErr = err as QueryFailedError & { code?: string; detail?: string };

    switch (pgErr.code) {
      case "23505": // unique_violation
        return fail("A record with this value already exists", 409, pgErr.detail);
      case "23503": // foreign_key_violation
        return fail("Related record not found", 409, pgErr.detail);
      case "23502": // not_null_violation
        return fail("A required field is missing", 400, pgErr.detail);
      default:
        return fail("Database error", 500);
    }
  }

  // Anything else (including malformed JWTs, which withAuth already
  // converts to a CustomAppError before they get here — see
  // middleware/withAuth.ts) is an unexpected server error. This used to
  // pattern-match err.message against a long list of magic strings
  // ("INVALID_OTP", "2FA_ALREADY_ENABLED", "ACCOUNT_LOCKED", refresh-token
  // reuse detection, etc.) left over from a different project's auth
  // system (2FA, backup codes, refresh-token rotation) — none of which
  // exist here, so none of those branches could ever actually be hit by
  // this app's code. Every real error condition in this app is raised as
  // a CustomAppError (handled above) or a QueryFailedError (handled
  // above); this is just the fallback for truly unexpected failures.
  return fail("Internal server error", 500);
}
