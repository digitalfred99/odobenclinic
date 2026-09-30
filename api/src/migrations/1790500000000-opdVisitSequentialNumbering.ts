import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Replaces OPDVisit's random-suffix opdNumber (e.g. "OPD-2026-A93KD1")
 * with a clinic-wide, sequential "line in this year's OPD book" number
 * (e.g. "12/2026" = the 12th OPD visit recorded at the clinic in 2026,
 * across all patients) — matching the physical attendance-card format
 * this system is meant to replace.
 *
 *  - opd_visit_counters: one row per year, holding the last position
 *    handed out. OPDVisitService.create() locks this row (SELECT ... FOR
 *    UPDATE) inside the same transaction as the visit insert so two
 *    concurrent visit creations can never receive the same position.
 *  - opd_visits.year / positionInYear: the real, queryable, immutable
 *    source of truth; opdNumber is just their formatted display string,
 *    generated once at creation and never recalculated.
 *  - Existing rows (if any) are backfilled in actual chronological order
 *    per year, and the counters are seeded from the resulting max
 *    position per year so new visits continue the sequence correctly.
 */
export class OpdVisitSequentialNumbering1790500000000 implements MigrationInterface {
  name = "OpdVisitSequentialNumbering1790500000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "opd_visit_counters" (
        "year" integer NOT NULL,
        "lastPosition" integer NOT NULL DEFAULT 0,
        CONSTRAINT "PK_opd_visit_counters_year" PRIMARY KEY ("year")
      )
    `);

    await queryRunner.query(`ALTER TABLE "opd_visits" ADD "year" integer`);
    await queryRunner.query(`ALTER TABLE "opd_visits" ADD "positionInYear" integer`);

    // Backfill: assign a real chronological position per year, ordered
    // the same way visit order is meaningful (visit date, then creation
    // order as a tiebreaker for same-day visits). Soft-deleted visits
    // still get numbered — they occupied a real line in the book at the
    // time — but are ordered after non-deleted ones within the same
    // date/year so a still-valid visit doesn't get displaced by a
    // cancelled one that happened to share a date.
    await queryRunner.query(`
      WITH ranked AS (
        SELECT
          id,
          EXTRACT(YEAR FROM "date")::int AS year,
          ROW_NUMBER() OVER (
            PARTITION BY EXTRACT(YEAR FROM "date")
            ORDER BY "isDeleted" ASC, "date" ASC, "createdAt" ASC
          ) AS position
        FROM "opd_visits"
      )
      UPDATE "opd_visits" v
      SET "year" = ranked.year, "positionInYear" = ranked.position
      FROM ranked
      WHERE v.id = ranked.id
    `);
    await queryRunner.query(`
      UPDATE "opd_visits"
      SET "opdNumber" = "positionInYear" || '/' || "year"
      WHERE "year" IS NOT NULL
    `);

    // Seed each year's counter from the backfilled max position so the
    // next visit created for that year continues the sequence.
    await queryRunner.query(`
      INSERT INTO "opd_visit_counters" ("year", "lastPosition")
      SELECT "year", MAX("positionInYear") FROM "opd_visits" WHERE "year" IS NOT NULL GROUP BY "year"
      ON CONFLICT ("year") DO UPDATE SET "lastPosition" = EXCLUDED."lastPosition"
    `);

    await queryRunner.query(`ALTER TABLE "opd_visits" ALTER COLUMN "year" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "opd_visits" ALTER COLUMN "positionInYear" SET NOT NULL`);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_opd_visits_year_position" ON "opd_visits" ("year", "positionInYear")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."UQ_opd_visits_year_position"`);
    await queryRunner.query(`ALTER TABLE "opd_visits" DROP COLUMN "positionInYear"`);
    await queryRunner.query(`ALTER TABLE "opd_visits" DROP COLUMN "year"`);
    await queryRunner.query(`DROP TABLE "opd_visit_counters"`);
  }
}
