import { CustomAppError } from "@/lib/errors/customAppError";
import { ErrorCodes } from "@/lib/errors/errorCodes";
import { CreatePatientDTO, UpdatePatientDTO } from "@/types/patient.type";
import { Gender, MaritalStatus } from "@/database/entities/Patient";

function fail(message: string): never {
  throw new CustomAppError( message, 400, ErrorCodes.VALIDATION_FAILED.code, ErrorCodes.VALIDATION_FAILED.label, "validation_failed" );
}

const DATE_OF_BIRTH_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const MAX_REASONABLE_AGE = 130;
const GH_CARD_REGEX = /^GHA-\d{9}-\d$/;
// Ghana NHIS membership numbers are exactly 8 digits, nothing else
// (e.g. "56738945") — no letters, no separators.
const NHIS_REGEX = /^\d{8}$/;

/**
 * Backend guardrails around dateOfBirth/age. Deliberately NOT trying to
 * be clever here (e.g. silently overwriting one from the other) — that's
 * exactly the kind of implicit behavior the spec calls out as a frontend
 * presentation concern. This only rejects data that cannot be correct:
 * malformed dates, dates in the future, ages outside a plausible human
 * lifespan, and a DOB/age pair that are wildly inconsistent with each
 * other (allowing generous slack, since "age" for an elderly patient is
 * often a rounded estimate, not a precise figure).
 */
function validateDateOfBirth(dateOfBirth: string): Date {
  if (!DATE_OF_BIRTH_REGEX.test(dateOfBirth)) {
    fail("dateOfBirth must be a valid date in YYYY-MM-DD format");
  }

  const dob = new Date(dateOfBirth + "T00:00:00.000Z");
  if (Number.isNaN(dob.getTime())) {
    fail("dateOfBirth must be a valid calendar date");
  }

  const today = new Date();
  if (dob.getTime() > today.getTime()) {
    fail("dateOfBirth cannot be in the future");
  }

  const oldestPossible = new Date();
  oldestPossible.setUTCFullYear(oldestPossible.getUTCFullYear() - MAX_REASONABLE_AGE);
  if (dob.getTime() < oldestPossible.getTime()) {
    fail(`dateOfBirth implies an age greater than ${MAX_REASONABLE_AGE} years, which is not accepted`);
  }

  return dob;
}

function ageFromDateOfBirth(dob: Date): number {
  const today = new Date();
  let age = today.getUTCFullYear() - dob.getUTCFullYear();
  const hasHadBirthdayThisYear =
    today.getUTCMonth() > dob.getUTCMonth() ||
    (today.getUTCMonth() === dob.getUTCMonth() && today.getUTCDate() >= dob.getUTCDate());
  if (!hasHadBirthdayThisYear) age -= 1;
  return age;
}

function validateAgeAndDob(data: Pick<CreatePatientDTO, "dateOfBirth" | "age">) {
  let dob: Date | undefined;

  if (data.dateOfBirth) {
    dob = validateDateOfBirth(data.dateOfBirth);
  }

  if (data.age !== undefined && data.age !== null) {
    if (!Number.isInteger(data.age) || data.age < 0 || data.age > MAX_REASONABLE_AGE) {
      fail(`age must be a whole number between 0 and ${MAX_REASONABLE_AGE}`);
    }
  }

  // Both provided: don't let age silently win over DOB, but do reject
  // combinations that can't both be true — a receptionist typo (e.g.
  // transposed birth year) is exactly the kind of bad data this should
  // catch. A few years of slack is allowed since "age" is frequently a
  // rounded, self-reported estimate rather than computed from a known DOB.
  if (dob && data.age !== undefined && data.age !== null) {
    const impliedAge = ageFromDateOfBirth(dob);
    const ALLOWED_DISCREPANCY_YEARS = 2;
    if (Math.abs(impliedAge - data.age) > ALLOWED_DISCREPANCY_YEARS) {
      fail(
        `The provided age (${data.age}) is inconsistent with the provided dateOfBirth (implies age ${impliedAge}). Please correct one of them.`
      );
    }
  }
}

/**
 * Optional on both create and update. Does nothing when undefined (field
 * not being set/changed) — the "is this patient allowed to have no
 * Ghana Card on file at all" question is a business decision, not a
 * format question, and this function only enforces the format.
 */
export function validateGhCardNumber(ghCardNumber: string | undefined) {
  if (ghCardNumber === undefined) return;
  if (!GH_CARD_REGEX.test(ghCardNumber.trim().toUpperCase())) {
    fail("ghCardNumber must be a valid Ghana Card number in the format GHA-XXXXXXXXX-X");
  }
}

/** Optional; when present must be exactly 8 digits. */
export function validateNhisNumber(nhisNumber: string | undefined) {
  if (nhisNumber === undefined) return;
  if (!NHIS_REGEX.test(nhisNumber.trim())) {
    fail("nhisNumber must be exactly 8 digits");
  }
}

export function validateCreatePatient(data: CreatePatientDTO) {
  if (!data.firstName?.trim()) fail("firstName is required");
  if (!data.lastName?.trim()) fail("lastName is required");
  // phone is intentionally optional — not every patient has (or should
  // be recorded under) a phone number, and the dedupe check falls back
  // to date of birth / age when phone isn't available.
  // Was `!(data.dateOfBirth && data.age)`, which actually required BOTH
  // to be set — the opposite of what the error message promises. This
  // now fails only when neither is present, matching "at least one".
  if (!data.dateOfBirth && !data.age) fail("Both dateOfBirth and age cannot be empty, at least one must be provided");
  if (!data.gender) fail("gender is required");
  if (!data.maritalStatus) fail("maritalStatus is required");

  validatePatientEnum(data);
  validateAgeAndDob(data);
  validateGhCardNumber(data.ghCardNumber);
  validateNhisNumber(data.nhisNumber);
}

export function validatePatientEnum(data: any): asserts data is CreatePatientDTO {
  if (data.gender && !Object.values(Gender).includes(data.gender)) {
    fail(`gender must be one of: ${Object.values(Gender).join(", ")}`);
  }
  if (data.maritalStatus && !Object.values(MaritalStatus).includes(data.maritalStatus)) {
    fail(`maritalStatus must be one of: ${Object.values(MaritalStatus).join(", ")}`);
  }
}

/**
 * Called from PatientService.update whenever the payload touches
 * dateOfBirth or age, so an update can't push the record into an
 * inconsistent state even though both fields are individually optional
 * on UpdatePatientDTO. `merged` should be the existing record overlaid
 * with the incoming patch, i.e. the state the row would end up in.
 */
export function validateUpdatedAgeAndDob(merged: { dateOfBirth?: string | null; age?: number | null }) {
  if (!merged.dateOfBirth && (merged.age === undefined || merged.age === null)) {
    fail("Both dateOfBirth and age cannot be empty, at least one must be provided");
  }
  validateAgeAndDob({
    dateOfBirth: merged.dateOfBirth ?? undefined,
    age: merged.age ?? undefined,
  });
}
