import { MigrationInterface, QueryRunner } from "typeorm";

export class Addpatientimg1791325306618 implements MigrationInterface {
    name = 'Addpatientimg1791325306618'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "patients" ADD "imageUrl" character varying`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "patients" DROP COLUMN "imageUrl"`);
    }

}
