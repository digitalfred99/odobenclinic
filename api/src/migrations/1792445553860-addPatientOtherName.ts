import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPatientOtherName1792445553860 implements MigrationInterface {
    name = 'AddPatientOtherName1792445553860'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "patients" ADD "otherName" character varying(255)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "patients" DROP COLUMN "otherName"`);
    }

}
