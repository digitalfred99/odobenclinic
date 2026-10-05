import { MigrationInterface, QueryRunner } from "typeorm";

export class Update1791210440722 implements MigrationInterface {
    name = 'Update1791210440722'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "patients" ADD "imageUrl" character varying`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "patients" DROP COLUMN "imageUrl"`);
    }

}
