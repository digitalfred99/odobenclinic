import { MigrationInterface, QueryRunner } from "typeorm";

export class Init1791158329665 implements MigrationInterface {
    name = 'Init1791158329665'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "audit_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "action" character varying NOT NULL, "entity_type" character varying NOT NULL, "entity_id" character varying, "metadata" jsonb, "ip_address" character varying, "user_agent" character varying, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "actor_id" uuid, CONSTRAINT "PK_1bb179d048bbc581caa3b013439" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."users_role_enum" AS ENUM('super_admin', 'admin', 'receptionist')`);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "isDeleted" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "firstName" character varying(255) NOT NULL, "lastName" character varying(255) NOT NULL, "email" character varying(255), "phone" character varying(20) NOT NULL, "password_hash" character varying NOT NULL, "role" "public"."users_role_enum" NOT NULL DEFAULT 'admin', "isActive" boolean NOT NULL DEFAULT true, CONSTRAINT "UQ_a000cca60bcf04454e727699490" UNIQUE ("phone"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_users_phone_active" ON "users"  ("phone") WHERE "isDeleted" = false`);
        await queryRunner.query(`CREATE TYPE "public"."patients_gender_enum" AS ENUM('female', 'male')`);
        await queryRunner.query(`CREATE TYPE "public"."patients_maritalstatus_enum" AS ENUM('single', 'married', 'divorced', 'widowed')`);
        await queryRunner.query(`CREATE TABLE "patients" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "isDeleted" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "patientId" character varying(20) NOT NULL, "year" integer NOT NULL, "positionInYear" integer NOT NULL, "firstName" character varying(255) NOT NULL, "lastName" character varying(255) NOT NULL, "dateOfBirth" date, "age" integer, "phone" character varying(20), "region" character varying(20), "district" character varying(100), "town" character varying(100), "area" character varying(100), "gender" "public"."patients_gender_enum" NOT NULL, "maritalStatus" "public"."patients_maritalstatus_enum" NOT NULL, "ghCardNumber" character varying(50), "nhisNumber" character varying(20), "created_by_id" uuid NOT NULL, CONSTRAINT "UQ_a4541d8ee871783657d9b139463" UNIQUE ("patientId"), CONSTRAINT "PK_a7f0b9fcbb3469d5ec0b0aceaa7" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_patients_nhis_active" ON "patients"  ("nhisNumber") WHERE "isDeleted" = false AND "nhisNumber" IS NOT NULL`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_patients_gh_card_active" ON "patients"  ("ghCardNumber") WHERE "isDeleted" = false AND "ghCardNumber" IS NOT NULL`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_patients_year_position" ON "patients"  ("year", "positionInYear") `);
        await queryRunner.query(`CREATE INDEX "IDX_patients_date_of_birth" ON "patients"  ("dateOfBirth") `);
        await queryRunner.query(`CREATE INDEX "IDX_patients_phone" ON "patients"  ("phone") `);
        await queryRunner.query(`CREATE INDEX "IDX_patients_last_first_name" ON "patients"  ("lastName", "firstName") `);
        await queryRunner.query(`CREATE TYPE "public"."opd_visits_newreturning_enum" AS ENUM('new', 'returning')`);
        await queryRunner.query(`CREATE TABLE "opd_visits" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "isDeleted" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "date" date NOT NULL, "remarks" text, "newReturning" "public"."opd_visits_newreturning_enum" NOT NULL, "patient_id" uuid NOT NULL, "created_by_id" uuid NOT NULL, CONSTRAINT "PK_83fd58bfbdaf33ae9102aa279f0" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_opd_visits_created_by_id" ON "opd_visits"  ("created_by_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_opd_visits_patient_id" ON "opd_visits"  ("patient_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_opd_visits_date" ON "opd_visits"  ("date") `);
        await queryRunner.query(`CREATE TABLE "opd_visit_counters" ("year" integer NOT NULL, "lastPosition" integer NOT NULL DEFAULT '0', CONSTRAINT "PK_2f7050d4f906fbf0f41fc8630d0" PRIMARY KEY ("year"))`);
        await queryRunner.query(`CREATE TABLE "patient_counters" ("year" integer NOT NULL, "lastPosition" integer NOT NULL DEFAULT '0', CONSTRAINT "PK_ab11a7a36a4a19e67336966203f" PRIMARY KEY ("year"))`);
        await queryRunner.query(`ALTER TABLE "audit_logs" ADD CONSTRAINT "FK_177183f29f438c488b5e8510cdb" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "patients" ADD CONSTRAINT "FK_b48dc58a26594f4674191275477" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "opd_visits" ADD CONSTRAINT "FK_bf3529e6d2af95f350c47fae108" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "opd_visits" ADD CONSTRAINT "FK_e3fd84ccbad4e242a6a0b025618" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "opd_visits" DROP CONSTRAINT "FK_e3fd84ccbad4e242a6a0b025618"`);
        await queryRunner.query(`ALTER TABLE "opd_visits" DROP CONSTRAINT "FK_bf3529e6d2af95f350c47fae108"`);
        await queryRunner.query(`ALTER TABLE "patients" DROP CONSTRAINT "FK_b48dc58a26594f4674191275477"`);
        await queryRunner.query(`ALTER TABLE "audit_logs" DROP CONSTRAINT "FK_177183f29f438c488b5e8510cdb"`);
        await queryRunner.query(`DROP TABLE "patient_counters"`);
        await queryRunner.query(`DROP TABLE "opd_visit_counters"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_opd_visits_date"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_opd_visits_patient_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_opd_visits_created_by_id"`);
        await queryRunner.query(`DROP TABLE "opd_visits"`);
        await queryRunner.query(`DROP TYPE "public"."opd_visits_newreturning_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_patients_last_first_name"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_patients_phone"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_patients_date_of_birth"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_patients_year_position"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_patients_gh_card_active"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_patients_nhis_active"`);
        await queryRunner.query(`DROP TABLE "patients"`);
        await queryRunner.query(`DROP TYPE "public"."patients_maritalstatus_enum"`);
        await queryRunner.query(`DROP TYPE "public"."patients_gender_enum"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_users_phone_active"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
        await queryRunner.query(`DROP TABLE "audit_logs"`);
    }

}
