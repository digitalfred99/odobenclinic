import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Backs the fixes made in this review:
 *  - opd_visits.patient_id FK: CASCADE -> RESTRICT. The Init migration
 *    (1790359429028) is what set this to CASCADE in the first place;
 *    that would let deleting a patient silently wipe their entire OPD
 *    visit history. Patients are only ever soft-deleted in the app
 *    layer, so RESTRICT should never actually fire — it's a backstop
 *    against a hard delete (manual DB cleanup, a future bug) destroying
 *    historical records.
 *  - opd_visits.new_returning: new NOT NULL enum column, backfilled for
 *    any pre-existing rows from actual visit order per patient (the
 *    earliest non-deleted visit per patient = 'new', everything after =
 *    'returning') so historical data isn't left inconsistent with how
 *    new rows are computed going forward (OPDVisitService.create).
 *  - Indexes needed for patient search/dedupe and OPD reporting/dashboard
 *    (name, phone, dateOfBirth on patients; date, patient_id,
 *    created_by_id on opd_visits) — none of these existed before.
 *  - DB-level CHECK constraints backstopping the "at least one of
 *    dateOfBirth/age" and age-range rules enforced in
 *    patient.validator.ts, so the data can't become inconsistent via any
 *    path that bypasses the application layer.
 */
export class PatientOpdIntegrityAndReporting1790400000000 implements MigrationInterface {
  name = "PatientOpdIntegrityAndReporting1790400000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── OPD visit -> patient FK: protect history ──────────────────
    await queryRunner.query(`ALTER TABLE "opd_visits" DROP CONSTRAINT "FK_bf3529e6d2af95f350c47fae108"`);
    await queryRunner.query(`ALTER TABLE "opd_visits" ADD CONSTRAINT "FK_bf3529e6d2af95f350c47fae108" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);

    // ── New/returning classification ──────────────────────────────
    await queryRunner.query(`CREATE TYPE "public"."opd_visits_newreturning_enum" AS ENUM('new', 'returning')`);
    await queryRunner.query(`ALTER TABLE "opd_visits" ADD "newReturning" "public"."opd_visits_newreturning_enum"`);

    // Backfill existing rows from actual history: the earliest
    // non-deleted visit per patient is 'new', every later one is
    // 'returning'. Deleted visits are excluded from "earliest" the same
    // way OPDVisitService.create's prior-visit count excludes them.
    await queryRunner.query(`
      WITH ranked AS (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY patient_id ORDER BY date ASC, "createdAt" ASC) AS rn
        FROM "opd_visits"
        WHERE "isDeleted" = false
      )
      UPDATE "opd_visits" v
      SET "newReturning" = CASE WHEN ranked.rn = 1 THEN 'new' ELSE 'returning' END
      FROM ranked
      WHERE v.id = ranked.id
    `);
    // Any remaining (soft-deleted) rows with no rank assigned still need
    // a value to satisfy the NOT NULL constraint below; default them to
    // 'returning' as the safer assumption for a record already excluded
    // from active reporting.
    await queryRunner.query(`UPDATE "opd_visits" SET "newReturning" = 'returning' WHERE "newReturning" IS NULL`);
    await queryRunner.query(`ALTER TABLE "opd_visits" ALTER COLUMN "newReturning" SET NOT NULL`);

    // ── Indexes ──────────────────────────────────────────────────
    await queryRunner.query(`CREATE INDEX "IDX_opd_visits_date" ON "opd_visits" ("date")`);
    await queryRunner.query(`CREATE INDEX "IDX_opd_visits_patient_id" ON "opd_visits" ("patient_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_opd_visits_created_by_id" ON "opd_visits" ("created_by_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_patients_last_first_name" ON "patients" ("lastName", "firstName")`);
    await queryRunner.query(`CREATE INDEX "IDX_patients_phone" ON "patients" ("phone")`);
    await queryRunner.query(`CREATE INDEX "IDX_patients_date_of_birth" ON "patients" ("dateOfBirth")`);

    // ── Data-integrity backstops ────────────────────────────────
    await queryRunner.query(`ALTER TABLE "patients" ADD CONSTRAINT "CHK_patients_dob_or_age" CHECK ("dateOfBirth" IS NOT NULL OR "age" IS NOT NULL)`);
    await queryRunner.query(`ALTER TABLE "patients" ADD CONSTRAINT "CHK_patients_age_range" CHECK ("age" IS NULL OR ("age" >= 0 AND "age" <= 130))`);
    await queryRunner.query(`ALTER TABLE "patients" ADD CONSTRAINT "CHK_patients_dob_not_future" CHECK ("dateOfBirth" IS NULL OR "dateOfBirth" <= CURRENT_DATE)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "patients" DROP CONSTRAINT "CHK_patients_dob_not_future"`);
    await queryRunner.query(`ALTER TABLE "patients" DROP CONSTRAINT "CHK_patients_age_range"`);
    await queryRunner.query(`ALTER TABLE "patients" DROP CONSTRAINT "CHK_patients_dob_or_age"`);

    await queryRunner.query(`DROP INDEX "public"."IDX_patients_date_of_birth"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_patients_phone"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_patients_last_first_name"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_opd_visits_created_by_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_opd_visits_patient_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_opd_visits_date"`);

    await queryRunner.query(`ALTER TABLE "opd_visits" DROP COLUMN "newReturning"`);
    await queryRunner.query(`DROP TYPE "public"."opd_visits_newreturning_enum"`);

    await queryRunner.query(`ALTER TABLE "opd_visits" DROP CONSTRAINT "FK_bf3529e6d2af95f350c47fae108"`);
    await queryRunner.query(`ALTER TABLE "opd_visits" ADD CONSTRAINT "FK_bf3529e6d2af95f350c47fae108" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
  }
}
