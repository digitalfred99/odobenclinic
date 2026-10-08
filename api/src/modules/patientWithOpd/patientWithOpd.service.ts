import { EntityManager } from "typeorm";
import { AppDataSource } from "@/database/data-source";
import { Patient } from "@/database/entities/Patient";
import { PatientCounter } from "@/database/entities/PatientCounter";
import { OPDVisit, NewReturning } from "@/database/entities/OPDVisit";
import { User } from "@/database/entities/User";
import { CreatePatientWithOpdDTO } from "@/types/patientWithOpd.type";
import { CreatePatientDTO } from "@/types/patient.type";
import { CustomAppError } from "@/lib/errors/customAppError";
import { ErrorCodes } from "@/lib/errors/errorCodes";
import { findPotentialDuplicate, lockPatientIdentity } from "@/modules/patient/patient.dedupe";
import { validateCreatePatient } from "@/modules/patient/patient.validator";
import { validateCreateOPDVisit } from "@/modules/opdVisit/opdVisit.validator";
import { writeAuditLog } from "@/lib/audit/writeAuditLog";
import { AuditAction, AuditEntityType } from "@/lib/audit/auditActions";

/**
 * Registers a new patient and their first OPD visit in a single request.
 *
 * This is deliberately self-contained: it does NOT call
 * PatientService.create / OPDVisitService.create, so changes to those
 * standalone flows can't break this one (and vice versa). The rules it
 * mirrors are: identity lock + duplicate check, per-year position
 * counter for patientId, audit logs for both records.
 *
 * Patient and visit are saved in ONE transaction — if either fails,
 * neither is saved.
 */
export class PatientWithOpdService {

  private static todayYear(): number {
    return new Date().getUTCFullYear();
  }

  private static todayAsDateString(): string {
    return new Date().toISOString().slice(0, 10);
  }

  /**
   * Atomically hands out the next clinic-wide registration position for
   * `year`. Same pattern as PatientService: orIgnore() creates the
   * year's counter row if missing, then a pessimistic_write lock
   * (SELECT ... FOR UPDATE) guarantees no two registrations get the
   * same positionInYear.
   */
  private static async nextPositionInYear(manager: EntityManager, year: number): Promise<number> {
    const counterRepo = manager.getRepository(PatientCounter);

    await counterRepo
      .createQueryBuilder()
      .insert()
      .into(PatientCounter)
      .values({ year, lastPosition: 0 })
      .orIgnore()
      .execute();

    const counter = await manager
      .createQueryBuilder(PatientCounter, "counter")
      .setLock("pessimistic_write")
      .where("counter.year = :year", { year })
      .getOneOrFail();

    const nextPosition = counter.lastPosition + 1;

    await counterRepo.update({ year }, { lastPosition: nextPosition });

    return nextPosition;
  }

  static async createPatientWithOpd(data: CreatePatientWithOpdDTO, actorUserId: string) {
    if (!data?.patient || typeof data.patient !== "object") {
      throw new CustomAppError("patient is required", 400, ErrorCodes.ID_REQUIRED.code, ErrorCodes.ID_REQUIRED.label, "bad_request");
    }

    // Copy so the caller's payload isn't mutated, then validate + normalise
    // before touching the database.
    const patientData: CreatePatientDTO = { ...data.patient };
    validateCreatePatient(patientData);
    if (patientData.ghCardNumber) patientData.ghCardNumber = patientData.ghCardNumber.trim().toUpperCase();
    if (patientData.nhisNumber) patientData.nhisNumber = patientData.nhisNumber.trim();

    const visitData = data.opdVisit ?? {};

    const db = await AppDataSource();

    const createdBy = await db.getRepository(User).findOne({
      where: { id: actorUserId, isDeleted: false, isActive: true },
    });
    if (!createdBy) {
      throw new CustomAppError("No authorized user found to register this patient", 404, ErrorCodes.UNAUTHORIZED_ACCESS.code, ErrorCodes.UNAUTHORIZED_ACCESS.label, "user_not_authorized");
    }

    // Don't echo the full User entity (passwordHash) back in the response.
    const safeCreatedBy = { id: createdBy.id, firstName: createdBy.firstName, lastName: createdBy.lastName };

    return db.transaction(async (manager: EntityManager) => {
      // ── Patient ────────────────────────────────────────────────
      await lockPatientIdentity(manager, {
        firstName: patientData.firstName,
        lastName: patientData.lastName,
        dateOfBirth: patientData.dateOfBirth ?? null,
        ghCardNumber: patientData.ghCardNumber ?? null,
        nhisNumber: patientData.nhisNumber ?? null,
      });

      const duplicate = await findPotentialDuplicate(manager, {
        firstName: patientData.firstName,
        lastName: patientData.lastName,
        gender: patientData.gender,
        dateOfBirth: patientData.dateOfBirth ?? null,
        age: patientData.age ?? null,
        phone: patientData.phone,
        ghCardNumber: patientData.ghCardNumber ?? null,
        nhisNumber: patientData.nhisNumber ?? null,
      });

      if (duplicate) {
        throw new CustomAppError(
          `An existing patient (ID: ${duplicate.patientId}) closely matches the information provided. Please review the record before creating a new patient.`,
          409,
          ErrorCodes.RECORD_ALREADY_EXISTS.code,
          ErrorCodes.RECORD_ALREADY_EXISTS.label,
          "patient_exists"
        );
      }

      const year = this.todayYear();
      const positionInYear = await this.nextPositionInYear(manager, year);

      const patientRepo = manager.getRepository(Patient);
      const savedPatient = await patientRepo.save(
        patientRepo.create({
          patientId: `PT-${positionInYear}/${year}`,
          year,
          positionInYear,
          firstName: patientData.firstName.trim(),
          lastName: patientData.lastName.trim(),
          phone: patientData.phone,
          dateOfBirth: patientData.dateOfBirth,
          age: patientData.age,
          region: patientData.region,
          district: patientData.district,
          town: patientData.town,
          area: patientData.area,
          gender: patientData.gender,
          maritalStatus: patientData.maritalStatus,
          ghCardNumber: patientData.ghCardNumber,
          nhisNumber: patientData.nhisNumber,
          createdBy,
        })
      );

      await writeAuditLog(
        {
          actorUserId,
          action: AuditAction.PATIENT_REGISTERED,
          entityType: AuditEntityType.PATIENT,
          entityId: savedPatient.id,
          metadata: { patientId: savedPatient.patientId },
        },
        manager
      );

      // ── OPD visit ──────────────────────────────────────────────
      // The validator expects the patient's id, which only exists now.
      // A failure here still rolls back the patient insert above.
      validateCreateOPDVisit({ ...visitData, patient: savedPatient.id });

      // A patient registered a moment ago has no earlier visits, so this
      // is always their NEW visit — no count query needed.
      const visitRepo = manager.getRepository(OPDVisit);
      const savedVisit = await visitRepo.save(
        visitRepo.create({
          date: visitData.date ?? this.todayAsDateString(),
          remarks: visitData.remarks || undefined,
          patient: savedPatient,
          createdBy,
          newReturning: NewReturning.NEW,
        })
      );

      await writeAuditLog(
        {
          actorUserId,
          action: AuditAction.OPD_VISIT_CREATED,
          entityType: AuditEntityType.OPDVISIT,
          entityId: savedVisit.id,
          metadata: { patientId: savedPatient.patientId, newReturning: savedVisit.newReturning },
        },
        manager
      );

      return {
        patient: { ...savedPatient, createdBy: safeCreatedBy },
        opdVisit: {
          id: savedVisit.id,
          date: savedVisit.date,
          remarks: savedVisit.remarks,
          newReturning: savedVisit.newReturning,
          createdAt: savedVisit.createdAt,
          createdBy: safeCreatedBy,
        },
      };
    });
  }
}