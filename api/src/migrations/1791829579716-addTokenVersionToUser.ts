import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTokenVersionToUser1791829579716 implements MigrationInterface {
    name = 'AddTokenVersionToUser1791829579716'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "tokenVersion" integer NOT NULL DEFAULT '0'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "tokenVersion"`);
    }

}
