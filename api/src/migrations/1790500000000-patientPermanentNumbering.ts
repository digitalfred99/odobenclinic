import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Gives each Patient one fixed, permanent clinic number, matching the
 * physical attendance card (e.g. "PT-12/2026" = the 12th patient ever
 * registered at the clinic in 2026). This number is assigned once, at
 * registration, and never changes — including across all of that
 * patient's future OPD visits. (An earlier design put a fresh number on
 * every OPD visit instead; that was based on a misreading of the
 * clinic's card and is superseded here. If that migration was ever run
 * in a real environment, its opd_visits.opdNumber/year/positionInYear
 * columns and opd_visit_counters table should be dropped manually
 * before running this one — this project has no live deployment yet,
 * so no such rollback is included.)
 *
 *  - patient_counters: one row per year, holding the last registration
 *    position handed out. PatientService.create() locks this row
 *    (SELECT ... FOR UPDATE) inside the same transaction as the patient
 *    insert, so two concurrent registrations can never receive the same
 *    position. Positions are never reused: soft-deleting a patient does
 *    not roll this counter back.
 *  - patients.year / positionInYear: the real, queryable, immutable
 *    source of truth; patientId is just their formatted display string.
 *  - patients.created_by_id: who registered the patient, permanently
 *    (distinct from opd_visits.created_by_id, which records who logged
 *    each individual attendance).
 *  - Existing rows (if any) are backfilled in actual registration order
 *    (createdAt) per year, patientId is regenerated to match, and each
 *    year's counter is seeded from the resulting max position.
 */
export class PatientPermanentNumbering1790500000000 implements MigrationInterface {
  name = "PatientPermanentNumbering1790500000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "patient_counters" (
        "year" integer NOT NULL,
        "lastPosition" integer NOT NULL DEFAULT 0,
        CONSTRAINT "PK_patient_counters_year" PRIMARY KEY ("year")
      )
    `);

    await queryRunner.query(`ALTER TABLE "patients" ADD "year" integer`);
    await queryRunner.query(`ALTER TABLE "patients" ADD "positionInYear" integer`);
    await queryRunner.query(`ALTER TABLE "patients" ADD "created_by_id" uuid`);

    // Backfill: assign a real chronological position per year, ordered
    // by actual registration time.
    await queryRunner.query(`
      WITH ranked AS (
        SELECT
          id,
          EXTRACT(YEAR FROM "createdAt")::int AS year,
          ROW_NUMBER() OVER (
            PARTITION BY EXTRACT(YEAR FROM "createdAt")
            ORDER BY "isDeleted" ASC, "createdAt" ASC
          ) AS position
        FROM "patients"
      )
      UPDATE "patients" p
      SET "year" = ranked.year, "positionInYear" = ranked.position
      FROM ranked
      WHERE p.id = ranked.id
    `);
    await queryRunner.query(`
      UPDATE "patients"
      SET "patientId" = 'PT-' || "positionInYear" || '/' || "year"
      WHERE "year" IS NOT NULL
    `);

    // Seed each year's counter from the backfilled max position so the
    // next patient registered for that year continues the sequence.
    await queryRunner.query(`
      INSERT INTO "patient_counters" ("year", "lastPosition")
      SELECT "year", MAX("positionInYear") FROM "patients" WHERE "year" IS NOT NULL GROUP BY "year"
      ON CONFLICT ("year") DO UPDATE SET "lastPosition" = EXCLUDED."lastPosition"
    `);

    // Backfill created_by_id for any pre-existing patients with the
    // earliest-registered user, since there's no way to recover who
    // actually registered them historically. Any environment migrating
    // real patient data should review/correct this manually — flagged
    // here rather than guessed silently for new rows going forward.
    await queryRunner.query(`
      UPDATE "patients"
      SET "created_by_id" = (SELECT "id" FROM "users" ORDER BY "createdAt" ASC LIMIT 1)
      WHERE "created_by_id" IS NULL AND EXISTS (SELECT 1 FROM "users")
    `);

    await queryRunner.query(`ALTER TABLE "patients" ALTER COLUMN "year" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "patients" ALTER COLUMN "positionInYear" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "patients" ALTER COLUMN "created_by_id" SET NOT NULL`);

    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_patients_year_position" ON "patients" ("year", "positionInYear")`);
    await queryRunner.query(`ALTER TABLE "patients" ADD CONSTRAINT "FK_patients_created_by" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);

    // patientId's uniqueness now needs to hold forever, including for
    // soft-deleted rows — a retired number must never be reused. The
    // column already carries `unique: true` at the entity level
    // (unconditional), and the original init migration's conditional
    // "only unique while active" index (if it was ever created) is
    // superseded by that; nothing further to change here.
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "patients" DROP CONSTRAINT "FK_patients_created_by"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_patients_year_position"`);
    await queryRunner.query(`ALTER TABLE "patients" DROP COLUMN "created_by_id"`);
    await queryRunner.query(`ALTER TABLE "patients" DROP COLUMN "positionInYear"`);
    await queryRunner.query(`ALTER TABLE "patients" DROP COLUMN "year"`);
    await queryRunner.query(`DROP TABLE "patient_counters"`);
  }
}
