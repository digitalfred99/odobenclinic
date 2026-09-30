import { validate as isUUID } from "uuid";
import { CustomAppError } from "@/lib/errors/customAppError";
import { ErrorCodes } from "@/lib/errors/errorCodes";
import { CreateOPDVisitDTO, UpdateOPDVisitDTO } from "@/types/opdVisit.type";

function fail(message: string): never {
  throw new CustomAppError( message, 400, ErrorCodes.VALIDATION_FAILED.code, ErrorCodes.VALIDATION_FAILED.label, "validation_failed" );
}

const VISIT_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A visit date is when the patient actually attended — it can be
 * back-dated (late data entry) but never in the future, since there's
 * no such thing as a future OPD attendance record.
 */
function validateVisitDate(date: string) {
  if (!VISIT_DATE_REGEX.test(date)) {
    fail("date must be a valid date in YYYY-MM-DD format");
  }

  const parsed = new Date(date + "T00:00:00.000Z");
  if (Number.isNaN(parsed.getTime())) {
    fail("date must be a valid calendar date");
  }

  const endOfToday = new Date();
  endOfToday.setUTCHours(23, 59, 59, 999);
  if (parsed.getTime() > endOfToday.getTime()) {
    fail("date cannot be in the future");
  }
}

export function validateCreateOPDVisit(data: CreateOPDVisitDTO) {
  if (!data.patient) fail("patient ID is required");
  if (!isUUID(data.patient)) fail("patient ID must be a valid identifier");

  // Note: who is creating the visit (`createdBy`) is always taken from
  // the authenticated request (req.user.sub), never from the request
  // body — a prior version of this validator checked a `data.createdBy`
  // field that the DTO never actually carried, which meant this check
  // could never fail in the way its author intended.
  if (data.date !== undefined) validateVisitDate(data.date);
}

export function validateUpdateOPDVisit(data: UpdateOPDVisitDTO) {
  if (data.date !== undefined) validateVisitDate(data.date);
}
