import { validateCreatePatient, validatePatientEnum, validateUpdatedAgeAndDob } from "@/modules/patient/patient.validator";
import { validate as isUUID } from "uuid";
import { Brackets, In, EntityManager } from "typeorm";
import { AppDataSource } from "@/database/data-source";
import { Patient, Gender, MaritalStatus } from "@/database/entities/Patient";
import { PatientCounter } from "@/database/entities/PatientCounter";
import { User } from "@/database/entities/User";
import { CreatePatientDTO, FilterPatientDTO, UpdatePatientDTO } from "@/types/patient.type";
import { CustomAppError } from "@/lib/errors/customAppError";
import { ErrorCodes } from "@/lib/errors/errorCodes";
import { buildPaginationMeta, parsePagination } from "@/lib/http/pagination";
import { PaginationQuery } from "@/types/pagination.type";
import { findPotentialDuplicate, lockPatientIdentity } from "@/modules/patient/patient.dedupe";
import { writeAuditLog } from "@/lib/audit/writeAuditLog";
import { AuditAction, AuditEntityType } from "@/lib/audit/auditActions";

export class PatientService {

  private static async repo() {
    const db = await AppDataSource();
    return db.getRepository(Patient);
  }

  static async getPatients(filters: FilterPatientDTO & PaginationQuery) {
      const repo = await this.repo();
      const patientsQuery = repo
        .createQueryBuilder("patient")
        .leftJoin("patient.createdBy", "createdBy")
        .addSelect(["createdBy.id", "createdBy.firstName", "createdBy.lastName"])
        .where("patient.isDeleted = :isDeleted", { isDeleted: false });

      if (filters.gender) {
        patientsQuery.andWhere("patient.gender = :gender", { gender: filters.gender as Gender });
      }
      if (filters.maritalStatus) {
        patientsQuery.andWhere("patient.maritalStatus = :maritalStatus", { maritalStatus: filters.maritalStatus as MaritalStatus });
      }
      // Exact-ish administrative-area filters, mainly used by reporting
      // ("patients from this region/district/town/area") — kept
      // case-insensitive since these are free-typed at registration time
      // and casing is not meaningful here.
      if (filters.region) {
        patientsQuery.andWhere("patient.region ILIKE :region", { region: filters.region });
      }
      if (filters.district) {
        patientsQuery.andWhere("patient.district ILIKE :district", { district: filters.district });
      }
      if (filters.town) {
        patientsQuery.andWhere("patient.town ILIKE :town", { town: filters.town });
      }
      if (filters.area) {
        patientsQuery.andWhere("patient.area ILIKE :area", { area: filters.area });
      }
      if (filters.patientId) {
        patientsQuery.andWhere("patient.patientId ILIKE :patientId", { patientId: `%${filters.patientId}%` });
      }

      const searchTerms = filters.search?.trim().split(/\s+/).filter(Boolean) ?? [];
      searchTerms.forEach((term, index) => {
        const parameter = `searchTerm${index}`;
        const pattern = `%${term}%`;

        patientsQuery.andWhere(
          new Brackets((searchQuery) => {
            searchQuery
              .where(`patient.firstName ILIKE :${parameter}`, { [parameter]: pattern })
              .orWhere(`patient.lastName ILIKE :${parameter}`, { [parameter]: pattern })
              .orWhere(`patient.phone ILIKE :${parameter}`, { [parameter]: pattern })
              // A receptionist searching by the number printed on the
              // patient's clinic card should hit this too.
              .orWhere(`patient.patientId ILIKE :${parameter}`, { [parameter]: pattern })
              .orWhere(`patient.region ILIKE :${parameter}`, { [parameter]: pattern })
              .orWhere(`patient.district ILIKE :${parameter}`, { [parameter]: pattern })
              .orWhere(`patient.town ILIKE :${parameter}`, { [parameter]: pattern })
              .orWhere(`patient.area ILIKE :${parameter}`, { [parameter]: pattern })
              // dateOfBirth/age are date/int columns — ILIKE on them
              // directly throws in Postgres ("operator does not exist").
              // Cast to text first so free-text search still works.
              .orWhere(`CAST(patient.dateOfBirth AS TEXT) ILIKE :${parameter}`, { [parameter]: pattern })
              .orWhere(`CAST(patient.age AS TEXT) ILIKE :${parameter}`, { [parameter]: pattern })
          })
        );
      });

      const { page, limit, skip, take } = parsePagination({
        page: filters.page?.toString(),
        limit: filters.limit?.toString(),
      });

      const [patients, count] = await patientsQuery
        .orderBy("patient.createdAt", "DESC")
        .skip(skip)
        .take(take)
        .getManyAndCount();

      return { patients: patients, pagination: buildPaginationMeta(count, page, limit) };
  }

  //Only admin or receptionist
  static async getPatient(id: string) {
    if (!id || !isUUID(id)) {
      throw new CustomAppError("Valid Patient ID is required", 400, ErrorCodes.ID_REQUIRED.code, ErrorCodes.ID_REQUIRED.label, "bad_request");
    }

    const repo = await this.repo();

    // createdBy is deliberately limited to id + name: loading the full
    // User relation would return its passwordHash to every caller.
    const patient = await repo
      .createQueryBuilder("patient")
      .leftJoin("patient.createdBy", "createdBy")
      .addSelect(["createdBy.id", "createdBy.firstName", "createdBy.lastName"])
      .where("patient.id = :id", { id })
      .andWhere("patient.isDeleted = :isDeleted", { isDeleted: false })
      .getOne();

    if (!patient) {
      throw new CustomAppError("No patient found with the given ID", 404, ErrorCodes.USER_NOT_FOUND.code, ErrorCodes.USER_NOT_FOUND.label, "patient_not_found");
    }

    return patient;
  }

  private static todayYear(): number {
    return new Date().getUTCFullYear();
  }

  /**
   * Atomically hands out the next clinic-wide registration position for
   * `year` and returns it. Must be called from inside the same
   * transaction that will insert the Patient row. Identical pattern
   * to (the now-removed) OPDVisit numbering, just triggered on patient
   * registration instead of every visit:
   *  1. `orIgnore()` insert creates the counter row for this year if
   *     it's the first patient registered that year — a no-op
   *     otherwise, safe if two transactions race to create it.
   *  2. `setLock("pessimistic_write")` (SELECT ... FOR UPDATE) takes a
   *     row lock on that year's counter, so a second concurrent
   *     registration blocks until the first commits — guaranteeing two
   *     new patients can never receive the same positionInYear.
   * Positions are never reused: soft-deleting a patient does not roll
   * this counter back.
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

  // actorUserId is who's registering the patient (the authenticated
  // receptionist/admin) — required, since it's now stored permanently
  // as Patient.createdBy (distinct from OPDVisit.createdBy, which
  // records who logged each individual visit).
  static async create(data: CreatePatientDTO, actorUserId: string) {
    validateCreatePatient(data);

    const db = await AppDataSource();
    const userRepo = db.getRepository(User);

    const createdBy = await userRepo.findOne({ where: { id: actorUserId, isDeleted: false, isActive: true } });
    if (!createdBy) {
      throw new CustomAppError("No authorized user found to register this patient", 404, ErrorCodes.UNAUTHORIZED_ACCESS.code, ErrorCodes.UNAUTHORIZED_ACCESS.label, "user_not_authorized");
    }

    return db.transaction(async (manager: EntityManager) => {
      // Serializes concurrent attempts to create "the same" patient —
      // without this, two simultaneous requests for "Jane Doe" could
      // both pass the check below and both insert.
      await lockPatientIdentity(manager, {
        firstName: data.firstName,
        lastName: data.lastName,
        dateOfBirth: data.dateOfBirth ?? null,
      });

      const duplicate = await findPotentialDuplicate(manager, {
        firstName: data.firstName,
        lastName: data.lastName,
        gender: data.gender,
        dateOfBirth: data.dateOfBirth ?? null,
        age: data.age ?? null,
        phone: data.phone,
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

      // The clinic's fixed, permanent number — e.g. positionInYear 12 in
      // 2026 becomes patientId "PT-12/2026". `year` is the registration
      // year, permanently, not tied to any later visit.
      const year = this.todayYear();
      const positionInYear = await this.nextPositionInYear(manager, year);

      const repo = manager.getRepository(Patient);
      const newPatient = repo.create({
        patientId: `PT-${positionInYear}/${year}`,
        year,
        positionInYear,
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        phone: data.phone,
        dateOfBirth: data.dateOfBirth,
        age: data.age,
        region: data.region,
        district: data.district,
        town: data.town,
        area: data.area,
        gender: data.gender,
        maritalStatus: data.maritalStatus,
        createdBy,
      });

      const savedPatient = await repo.save(newPatient);

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

      // Don't echo the full User entity (passwordHash) back in the response.
      return {
        ...savedPatient,
        createdBy: { id: createdBy.id, firstName: createdBy.firstName, lastName: createdBy.lastName },
      };
    });
  }

  static async update(id: string, data: UpdatePatientDTO, actorUserId?: string) {
    if (!id || !isUUID(id)) {
      throw new CustomAppError("Valid Patient ID is required", 400, ErrorCodes.ID_REQUIRED.code, ErrorCodes.ID_REQUIRED.label, "bad_request");
    }

    validatePatientEnum(data);

    const db = await AppDataSource();

    return db.transaction(async (manager: EntityManager) => {
      const repo = manager.getRepository(Patient);

      const existingPatient = await repo.findOne({ where: { id, isDeleted: false } });
      if (!existingPatient) {
        throw new CustomAppError("No patient found with the given ID", 404, ErrorCodes.USER_NOT_FOUND.code, ErrorCodes.USER_NOT_FOUND.label, "patient_not_found");
      }

      // Only bother locking + checking when an identity-relevant field is
      // actually changing — no need to contend for a lock when someone's
      // just updating an address or marital status.
      const identityFields = ["firstName", "lastName", "gender", "dateOfBirth", "phone", "age"] as const;
      const identityFieldsChanged = identityFields.some(
        (key) => key in data && (data as any)[key] !== (existingPatient as any)[key]
      );

      const merged = { ...existingPatient, ...data };

      // dateOfBirth/age can each be patched independently (both optional
      // on UpdatePatientDTO), so re-validate the *resulting* pair rather
      // than just the fields present on this particular request — that's
      // the only way to catch an update that, say, clears dateOfBirth
      // while age was never set either.
      if ("dateOfBirth" in data || "age" in data) {
        validateUpdatedAgeAndDob({ dateOfBirth: merged.dateOfBirth, age: merged.age });
      }

      if (identityFieldsChanged) {
        await lockPatientIdentity(manager, {
          firstName: merged.firstName,
          lastName: merged.lastName,
          dateOfBirth: merged.dateOfBirth ?? null,
        });

        const duplicate = await findPotentialDuplicate(
          manager,
          {
            firstName: merged.firstName,
            lastName: merged.lastName,
            gender: merged.gender,
            dateOfBirth: merged.dateOfBirth ?? null,
            age: merged.age ?? null,
            phone: merged.phone,
          },
          id
        );

        if (duplicate) {
          throw new CustomAppError(
            `This update would make the record match an existing patient (ID: ${duplicate.patientId}). Please review before saving.`,
            409,
            ErrorCodes.RECORD_ALREADY_EXISTS.code,
            ErrorCodes.RECORD_ALREADY_EXISTS.label,
            "patient_exists"
          );
        }
      }

      const updatedPatient = repo.merge(existingPatient, data);
      const savedPatient = await repo.save(updatedPatient);

      await writeAuditLog(
        {
          actorUserId,
          action: AuditAction.PATIENT_PROFILE_UPDATED,
          entityType: AuditEntityType.PATIENT,
          entityId: savedPatient.id,
          metadata: { changedFields: Object.keys(data) },
        },
        manager
      );

      return savedPatient;
    });
  }

  static async delete(ids: string[], actorUserId?: string) {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new CustomAppError("Invalid request IDs", 400, ErrorCodes.ID_REQUIRED.code, ErrorCodes.ID_REQUIRED.label, "bad_request");
    }

    const db = await AppDataSource();

    return db.transaction(async (manager: EntityManager) => {
      const repo = manager.getRepository(Patient);

      const records = await repo.find({
        where: { id: In(ids), isDeleted: false },
      });

      if (records.length === 0) {
        throw new CustomAppError("No matching records found to delete", 404, ErrorCodes.RECORD_NOT_FOUND.code, ErrorCodes.RECORD_NOT_FOUND.label, "not_found");
      }

      records.forEach(record => {
        record.isDeleted = true;
      });

      const savedRecords = await repo.save(records);

      for (const record of savedRecords) {
        await writeAuditLog(
          {
            actorUserId,
            action: AuditAction.PATIENT_DELETED,
            entityType: AuditEntityType.PATIENT,
            entityId: record.id,
            metadata: { patientId: record.patientId },
          },
          manager
        );
      }

      return savedRecords;
    });
  }
}