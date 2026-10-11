import { MigrationInterface, QueryRunner } from "typeorm";

export class Init1791477694829 implements MigrationInterface {
    name = 'Init1791477694829'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "opd_visits" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "isDeleted" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "date" date NOT NULL, "remarks" text, "newReturning" "public"."opd_visits_newreturning_enum" NOT NULL, "patient_id" uuid NOT NULL, "created_by_id" uuid NOT NULL, CONSTRAINT "PK_83fd58bfbdaf33ae9102aa279f0" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_opd_visits_created_by_id" ON "opd_visits"  ("created_by_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_opd_visits_patient_id" ON "opd_visits"  ("patient_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_opd_visits_date" ON "opd_visits"  ("date") `);
        await queryRunner.query(`ALTER TABLE "opd_visits" ADD CONSTRAINT "FK_bf3529e6d2af95f350c47fae108" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "opd_visits" ADD CONSTRAINT "FK_e3fd84ccbad4e242a6a0b025618" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "opd_visits" DROP CONSTRAINT "FK_e3fd84ccbad4e242a6a0b025618"`);
        await queryRunner.query(`ALTER TABLE "opd_visits" DROP CONSTRAINT "FK_bf3529e6d2af95f350c47fae108"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_opd_visits_date"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_opd_visits_patient_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_opd_visits_created_by_id"`);
        await queryRunner.query(`DROP TABLE "opd_visits"`);
    }

}
