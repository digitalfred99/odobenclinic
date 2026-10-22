import { MigrationInterface, QueryRunner } from "typeorm";

export class Init1792660816199 implements MigrationInterface {
    name = 'Init1792660816199'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "patients" ADD "email" character varying(100)`);
        await queryRunner.query(`ALTER TABLE "patients" ADD "postalAddress" character varying(100)`);
        await queryRunner.query(`CREATE TYPE "public"."patients_religion_enum" AS ENUM('christianity', 'islam', 'traditional', 'other')`);
        await queryRunner.query(`ALTER TABLE "patients" ADD "religion" "public"."patients_religion_enum" NOT NULL`);
        await queryRunner.query(`ALTER TABLE "patients" ADD "occupation" character varying(100)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "patients" DROP COLUMN "occupation"`);
        await queryRunner.query(`ALTER TABLE "patients" DROP COLUMN "religion"`);
        await queryRunner.query(`DROP TYPE "public"."patients_religion_enum"`);
        await queryRunner.query(`ALTER TABLE "patients" DROP COLUMN "postalAddress"`);
        await queryRunner.query(`ALTER TABLE "patients" DROP COLUMN "email"`);
    }

}
