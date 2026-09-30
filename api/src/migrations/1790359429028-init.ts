import { MigrationInterface, QueryRunner } from "typeorm";

export class Init1790359429028 implements MigrationInterface {
    name = 'Init1790359429028'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "opd_visits" DROP CONSTRAINT "FK_bf3529e6d2af95f350c47fae108"`);
        await queryRunner.query(`ALTER TABLE "patients" DROP COLUMN "isActive"`);
        await queryRunner.query(`ALTER TABLE "patients" DROP COLUMN "password_hash"`);
        await queryRunner.query(`ALTER TABLE "opd_visits" DROP COLUMN "isActive"`);
        await queryRunner.query(`ALTER TABLE "patients" ADD "region" character varying(20)`);
        await queryRunner.query(`ALTER TABLE "patients" ADD "district" character varying(100)`);
        await queryRunner.query(`ALTER TABLE "patients" ADD "town" character varying(100)`);
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "isActive" SET DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "patients" DROP COLUMN "area"`);
        await queryRunner.query(`ALTER TABLE "patients" ADD "area" character varying(100)`);
        await queryRunner.query(`ALTER TABLE "opd_visits" ADD CONSTRAINT "FK_bf3529e6d2af95f350c47fae108" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "opd_visits" DROP CONSTRAINT "FK_bf3529e6d2af95f350c47fae108"`);
        await queryRunner.query(`ALTER TABLE "patients" DROP COLUMN "area"`);
        await queryRunner.query(`ALTER TABLE "patients" ADD "area" character varying(255) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "isActive" SET DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "patients" DROP COLUMN "town"`);
        await queryRunner.query(`ALTER TABLE "patients" DROP COLUMN "district"`);
        await queryRunner.query(`ALTER TABLE "patients" DROP COLUMN "region"`);
        await queryRunner.query(`ALTER TABLE "opd_visits" ADD "isActive" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "patients" ADD "password_hash" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "patients" ADD "isActive" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "opd_visits" ADD CONSTRAINT "FK_bf3529e6d2af95f350c47fae108" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

}
