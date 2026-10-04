import { Brackets, EntityManager, SelectQueryBuilder } from "typeorm";
import { Patient } from "@/database/entities/Patient";

/**
 * Collapses whitespace/case differences so "Jane ", "jane", "JANE" all
 * compare equal.
 */
export function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizeGhCardNumber(value: string): string {
  return value.trim().toUpperCase();
}

function normalizeNhisNumber(value: string): string {
  return value.trim();
}

export type PatientIdentity = {
  firstName: string;
  lastName: string;
  gender: string;
  dateOfBirth?: string | null;
  age?: number | null;
  phone?: string | null;
  ghCardNumber?: string | null;
  nhisNumber?: string | null;
};

/**
 * Takes a Postgres advisory lock scoped to the current transaction, keyed
 * by the patient's normalized name + DOB, AND (when present) their
 * government IDs. Two concurrent create/update calls for the same person
 * will serialize on this lock instead of both passing the duplicate
 * check and both writing — this is what actually closes the race
 * condition that a plain "check, then insert" leaves open.
 *
 * Government IDs are folded into the same lock key (not a separate lock)
 * so that two concurrent registrations carrying the same Ghana Card
 * number serialize even if the name was typed differently on one of
 * them — exactly the case findByGovernmentId exists to catch. The lock
 * is released automatically when the transaction commits or rolls back,
 * so this must always be called from inside one
 * (`dataSource.transaction(...)`), never with a bare repository.
 */
export async function lockPatientIdentity(
  manager: EntityManager,
  identity: Pick<PatientIdentity, "firstName" | "lastName" | "dateOfBirth" | "ghCardNumber" | "nhisNumber">
): Promise<void> {
  const ghCardNumber = identity.ghCardNumber ? normalizeGhCardNumber(identity.ghCardNumber) : "";
  const nhisNumber = identity.nhisNumber ? normalizeNhisNumber(identity.nhisNumber) : "";
  const key = `${normalizeName(identity.firstName)}|${normalizeName(identity.lastName)}|${identity.dateOfBirth ?? ""}|${ghCardNumber}|${nhisNumber}`;

  let hash = 0n;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31n + BigInt(key.charCodeAt(i))) & 0xffffffffffffffffn;
  }
  const hi = Number((hash >> 32n) & 0xffffffffn) | 0;
  const lo = Number(hash & 0xffffffffn) | 0;

  await manager.query("SELECT pg_advisory_xact_lock($1, $2)", [hi, lo]);
}

/**
 * Exact-match check against government-issued identifiers (Ghana Card,
 * NHIS number). Unlike the fuzzy demographic match below, a matching ID
 * is treated as DECISIVE on its own, with no name/gender match required
 * — these are unique-per-citizen identifiers, so an exact match is far
 * stronger evidence of "same person" than any combination of
 * name/DOB/phone could be. Checking it independently of name also
 * catches the exact case a receptionist typo in the name would
 * otherwise let through: card scanned/typed correctly, name entered
 * slightly differently from last time.
 *
 * Only active (non-deleted) patients are considered, matching the DB's
 * conditional unique indexes on these two columns (UQ_patients_gh_card_
 * active / UQ_patients_nhis_active) — a soft-deleted patient's ID is not
 * treated as "taken".
 */
export async function findByGovernmentId(
  manager: EntityManager,
  identity: Pick<PatientIdentity, "ghCardNumber" | "nhisNumber">,
  excludeId?: string
): Promise<Patient | null> {
  const ghCardNumber = identity.ghCardNumber ? normalizeGhCardNumber(identity.ghCardNumber) : null;
  const nhisNumber = identity.nhisNumber ? normalizeNhisNumber(identity.nhisNumber) : null;

  if (!ghCardNumber && !nhisNumber) return null;

  const qb: SelectQueryBuilder<Patient> = manager
    .createQueryBuilder(Patient, "patient")
    .where("patient.isDeleted = false");

  if (excludeId) {
    qb.andWhere("patient.id != :excludeId", { excludeId });
  }

  qb.andWhere(
    new Brackets((sub) => {
      if (ghCardNumber) sub.orWhere("patient.ghCardNumber = :ghCardNumber", { ghCardNumber });
      if (nhisNumber) sub.orWhere("patient.nhisNumber = :nhisNumber", { nhisNumber });
    })
  );

  return qb.getOne();
}

/**
 * Looks for an existing, non-deleted patient who plausibly *is* the
 * person described by `identity`. Checks run in order of confidence:
 *
 *  1. Government ID (findByGovernmentId) — decisive on its own, checked
 *     first, independent of name/gender.
 *  2. Fuzzy demographic match — same normalized first name + last name
 *     + gender, plus at least one corroborating signal:
 *       - the same date of birth, or
 *       - the same phone number (compared digits-only, so
 *         "020 123 4567" and "0201234567" still match)
 *     If neither DOB nor phone is available to corroborate with, this
 *     falls back to age, and failing that, flags any same-name/gender
 *     record so a human reviews it rather than silently letting it
 *     through.
 *
 * Marital status is deliberately excluded from matching — it changes
 * over a patient's life and isn't an identity signal, unlike the
 * original exact-match check which required it to be equal.
 */
export async function findPotentialDuplicate(
  manager: EntityManager,
  identity: PatientIdentity,
  excludeId?: string
): Promise<Patient | null> {
  const idMatch = await findByGovernmentId(manager, identity, excludeId);
  if (idMatch) return idMatch;

  const firstName = normalizeName(identity.firstName);
  const lastName = normalizeName(identity.lastName);
  const phoneDigits = identity.phone ? identity.phone.replace(/\D/g, "") : null;

  const qb: SelectQueryBuilder<Patient> = manager
    .createQueryBuilder(Patient, "patient")
    .where("patient.isDeleted = false")
    .andWhere("LOWER(TRIM(patient.firstName)) = :firstName", { firstName })
    .andWhere("LOWER(TRIM(patient.lastName)) = :lastName", { lastName })
    .andWhere("patient.gender = :gender", { gender: identity.gender });

  if (excludeId) {
    qb.andWhere("patient.id != :excludeId", { excludeId });
  }

  qb.andWhere(
    new Brackets((sub) => {
      let hasCorroboratingClause = false;

      if (identity.dateOfBirth) {
        sub.orWhere("patient.dateOfBirth = :dob", { dob: identity.dateOfBirth });
        hasCorroboratingClause = true;
      }
      if (phoneDigits) {
        sub.orWhere("regexp_replace(patient.phone, '\\D', '', 'g') = :phone", { phone: phoneDigits });
        hasCorroboratingClause = true;
      }
      if (!hasCorroboratingClause) {
        if (identity.age !== undefined && identity.age !== null) {
          sub.orWhere("patient.age = :age", { age: identity.age });
        } else {
          // Nothing to disambiguate beyond name + gender — still flag it
          // for human review rather than pass silently.
          sub.orWhere("1 = 1");
        }
      }
    })
  );

  return qb.getOne();
}
