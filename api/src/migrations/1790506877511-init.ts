import { MigrationInterface, QueryRunner } from "typeorm";

export class Init1790506877511 implements MigrationInterface {
    name = 'Init1790506877511'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "opd_visit_counters" ("year" integer NOT NULL, "lastPosition" integer NOT NULL DEFAULT '0', CONSTRAINT "PK_2f7050d4f906fbf0f41fc8630d0" PRIMARY KEY ("year"))`);
        await queryRunner.query(`ALTER TABLE "opd_visits" ADD "year" integer NOT NULL`);
        await queryRunner.query(`ALTER TABLE "opd_visits" ADD "positionInYear" integer NOT NULL`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_opd_visits_year_position" ON "opd_visits"  ("year", "positionInYear") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."UQ_opd_visits_year_position"`);
        await queryRunner.query(`ALTER TABLE "opd_visits" DROP COLUMN "positionInYear"`);
        await queryRunner.query(`ALTER TABLE "opd_visits" DROP COLUMN "year"`);
        await queryRunner.query(`DROP TABLE "opd_visit_counters"`);
    }

}
