import { validateCreatePatient, validatePatientEnum, validateUpdatedAgeAndDob, validateGhCardNumber, validateNhisNumber, validateManualPatientNumber } from "@/modules/patient/patient.validator";
import { validate as isUUID } from "uuid";
import { Brackets, In, EntityManager } from "typeorm";
import { AppDataSource } from "@/database/data-source";
import { Patient, Gender, MaritalStatus } from "@/database/entities/Patient";
import { PatientCounter } from "@/database/entities/PatientCounter";
import { User } from "@/database/entities/User";
import { CreatePatientManualDTO, FilterPatientDTO, UpdatePatientDTO } from "@/types/patient.type";
import { CustomAppError } from "@/lib/errors/customAppError";
import { ErrorCodes } from "@/lib/errors/errorCodes";
import { buildPaginationMeta, parsePagination } from "@/lib/http/pagination";
import { PaginationQuery } from "@/types/pagination.type";
import {
  findByGovernmentId,
  findDemographicDuplicate,
  findPotentialDuplicate,
  lockPatientIdentity,
} from "@/modules/patient/patient.dedupe";
import { writeAuditLog } from "@/lib/audit/writeAuditLog";
import { AuditAction, AuditEntityType } from "@/lib/audit/auditActions";
import { type ImageFileInput } from "@/lib/storage/createWithImages";
import { getStorageAdapter } from "@/lib/storage/getStorageAdapter";
import { savePatientPhoto } from "../../utils/helpers/patients/savePatientPhoto";
import { applyTextCase } from "@/utils/helpers/capitalize";
import { PATIENT_TEXT_CASE } from "./patient.constants";
import { formatPatientId } from "@/utils/helpers/patients/formatPatientId";

const patientIdTakenError = (patientId: string) =>
  new CustomAppError(
    `Patient ID ${patientId} is already in use`, 409,
    ErrorCodes.RECORD_ALREADY_EXISTS.code, ErrorCodes.RECORD_ALREADY_EXISTS.label, "patient_id_exists"
  );

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
              .orWhere(`patient.otherName ILIKE :${parameter}`, { [parameter]: pattern })
              .orWhere(`patient.phone ILIKE :${parameter}`, { [parameter]: pattern })
              // A receptionist searching by the number printed on the
              // patient's clinic card should hit this too.
              .orWhere(`patient.patientId ILIKE :${parameter}`, { [parameter]: pattern })
              .orWhere(`patient.ghCardNumber ILIKE :${parameter}`, { [parameter]: pattern })
              .orWhere(`patient.nhisNumber ILIKE :${parameter}`, { [parameter]: pattern })
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

  private static async reservePosition(manager: EntityManager, year: number, position: number) {
    const counterRepo = manager.getRepository(PatientCounter);
    await counterRepo.createQueryBuilder().insert().into(PatientCounter)
      .values({ year, lastPosition: 0 }).orIgnore().execute();
    const counter = await manager.createQueryBuilder(PatientCounter, "counter")
      .setLock("pessimistic_write").where("counter.year = :year", { year }).getOneOrFail();
    if (position > counter.lastPosition) {
      await counterRepo.update({ year }, { lastPosition: position });
    }
  }

  // actorUserId is who's registering the patient (the authenticated
  // receptionist/admin) — required, since it's now stored permanently
  // as Patient.createdBy (distinct from OPDVisit.createdBy, which
  // records who logged each individual visit).
  static async create(data: CreatePatientManualDTO, actorUserId: string, image?: ImageFileInput) {
    validateCreatePatient(data);
    validateManualPatientNumber(data);
    data = applyTextCase(data, PATIENT_TEXT_CASE);

    if (data.ghCardNumber) data.ghCardNumber = data.ghCardNumber.trim().toUpperCase();
    if (data.nhisNumber) data.nhisNumber = data.nhisNumber.trim();

    const db = await AppDataSource();
    const userRepo = db.getRepository(User);

    const createdBy = await userRepo.findOne({ where: { id: actorUserId, isDeleted: false, isActive: true } });
    if (!createdBy) {
      throw new CustomAppError("No authorized user found to register this patient", 404, ErrorCodes.UNAUTHORIZED_ACCESS.code, ErrorCodes.UNAUTHORIZED_ACCESS.label, "user_not_authorized");
    }

    const persistOnce = (imageUrl?: string) =>
      db.transaction(async (manager: EntityManager) => {
        await lockPatientIdentity(manager, {
          firstName: data.firstName,
          lastName: data.lastName,
          dateOfBirth: data.dateOfBirth ?? null,
          ghCardNumber: data.ghCardNumber ?? null,
          nhisNumber: data.nhisNumber ?? null,
        });

        const identity = {
          firstName: data.firstName,
          lastName: data.lastName,
          gender: data.gender,
          dateOfBirth: data.dateOfBirth ?? null,
          age: data.age ?? null,
          phone: data.phone,
          ghCardNumber: data.ghCardNumber ?? null,
          nhisNumber: data.nhisNumber ?? null,
        };
        const governmentIdDuplicate = await findByGovernmentId(manager, identity);
        if (governmentIdDuplicate) {
          throw new CustomAppError(
            `An existing patient (ID: ${governmentIdDuplicate.patientId}) has the same Ghana Card or NHIS number. This number cannot be reused.`,
            409,
            ErrorCodes.RECORD_ALREADY_EXISTS.code,
            ErrorCodes.RECORD_ALREADY_EXISTS.label,
            "patient_government_id_exists"
          );
        }
        const duplicate = await findDemographicDuplicate(manager, identity);

        if (duplicate && duplicate.patientId !== data.confirmedDuplicatePatientId) {
          throw new CustomAppError(
            `An existing patient (ID: ${duplicate.patientId}) closely matches the information provided. Please review the record before creating a new patient.`,
            409,
            ErrorCodes.RECORD_ALREADY_EXISTS.code,
            ErrorCodes.RECORD_ALREADY_EXISTS.label,
            "patient_exists"
          );
        }

        const { year, positionInYear } = data;
        const patientId = formatPatientId(year, positionInYear);

        // No isDeleted filter on purpose: a retired ID must never be reused.
        const taken = await manager.getRepository(Patient).findOne({
          where: [{ patientId }, { year, positionInYear }],
          select: { id: true },
        });
        if (taken) throw patientIdTakenError(patientId);

        // For the current year, move the counter past this number.
        if (year === this.todayYear()) {
          await this.reservePosition(manager, year, positionInYear);
        }

        const repo = manager.getRepository(Patient);
        const newPatient = repo.create({
          patientId,
          year,
          positionInYear,
          firstName: data.firstName.trim(),
          lastName: data.lastName.trim(),
          otherName: data.otherName?.trim(),
          phone: data.phone,
          dateOfBirth: data.dateOfBirth,
          age: data.age,
          region: data.region,
          district: data.district,
          town: data.town,
          area: data.area,
          gender: data.gender,
          maritalStatus: data.maritalStatus,
          ghCardNumber: data.ghCardNumber,
          nhisNumber: data.nhisNumber,
          imageUrl,
          createdBy,
        });

        const savedPatient = await repo.save(newPatient);

        await writeAuditLog(
          {
            actorUserId,
            action: AuditAction.PATIENT_REGISTERED,
            entityType: AuditEntityType.PATIENT,
            entityId: savedPatient.id,
            metadata: { patientId: savedPatient.patientId, manual: true },
          },
          manager
        );

        return {
          ...savedPatient,
          createdBy: { id: createdBy.id, firstName: createdBy.firstName, lastName: createdBy.lastName },
        };
      });

    const persist = async (imageUrl?: string) => {
      try {
        return await persistOnce(imageUrl);
      } catch (err: any) {
        const code = err?.code ?? err?.driverError?.code;
        const detail = String(err?.detail ?? err?.driverError?.detail ?? "");
        if (code === "23505" && (detail.includes("patientId") || detail.includes("positionInYear"))) {
          throw patientIdTakenError(formatPatientId(data.year, data.positionInYear));
        }
        throw err;
      }
    };

    if (image) {
      return await savePatientPhoto(image, (imageUrl) => persist(imageUrl));
    }

    return await persist();
  }

  static async update(id: string, data: UpdatePatientDTO, actorUserId?: string, image?: ImageFileInput) {
    if (!id || !isUUID(id)) {
      throw new CustomAppError("Valid Patient ID is required", 400, ErrorCodes.ID_REQUIRED.code, ErrorCodes.ID_REQUIRED.label, "bad_request");
    }

    // Mass-assignment guard: imageUrl is only ever set from an uploaded file.
    delete (data as Record<string, unknown>).imageUrl;
    for (const key of ["patientId", "year", "positionInYear"]) {
      delete (data as Record<string, unknown>)[key];
    }

    validatePatientEnum(data);
    validateGhCardNumber(data.ghCardNumber);
    validateNhisNumber(data.nhisNumber);
    if (data.ghCardNumber) data.ghCardNumber = data.ghCardNumber.trim().toUpperCase();
    if (data.nhisNumber) data.nhisNumber = data.nhisNumber.trim();

    data = applyTextCase(data, PATIENT_TEXT_CASE);

    const db = await AppDataSource();
    const replaced: { url?: string } = {}; // previous photo, deleted only after commit

    const persist = (newImageUrl?: string) =>
      db.transaction(async (manager: EntityManager) => {
        const repo = manager.getRepository(Patient);

        const existingPatient = await repo.findOne({
          where: { id, isDeleted: false },
          lock: { mode: "pessimistic_write" },
        });
        if (!existingPatient) {
          throw new CustomAppError("No patient found with the given ID", 404, ErrorCodes.USER_NOT_FOUND.code, ErrorCodes.USER_NOT_FOUND.label, "patient_not_found");
        }

        const identityFields = ["firstName", "lastName", "gender", "dateOfBirth", "phone", "age", "ghCardNumber", "nhisNumber"] as const;
        const identityFieldsChanged = identityFields.some(
          (key) => key in data && (data as any)[key] !== (existingPatient as any)[key]
        );

        const merged = { ...existingPatient, ...data };

        if ("dateOfBirth" in data || "age" in data) {
          validateUpdatedAgeAndDob({ dateOfBirth: merged.dateOfBirth, age: merged.age });
        }

        if (identityFieldsChanged) {
          await lockPatientIdentity(manager, {
            firstName: merged.firstName,
            lastName: merged.lastName,
            dateOfBirth: merged.dateOfBirth ?? null,
            ghCardNumber: merged.ghCardNumber ?? null,
            nhisNumber: merged.nhisNumber ?? null,
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
              ghCardNumber: merged.ghCardNumber ?? null,
              nhisNumber: merged.nhisNumber ?? null,
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

        const previousImageUrl = existingPatient.imageUrl;

        const updatedPatient = repo.merge(existingPatient, data, newImageUrl ? { imageUrl: newImageUrl } : {});
        const savedPatient = await repo.save(updatedPatient);

        await writeAuditLog(
          {
            actorUserId,
            action: AuditAction.PATIENT_PROFILE_UPDATED,
            entityType: AuditEntityType.PATIENT,
            entityId: savedPatient.id,
            metadata: { changedFields: [...Object.keys(data), ...(newImageUrl ? ["imageUrl"] : [])] },
          },
          manager
        );

        if (newImageUrl) replaced.url = previousImageUrl;
        return savedPatient;
      });

    if (!image) return await persist();

    const saved = await savePatientPhoto(image, (imageUrl) => persist(imageUrl));

    // Committed — now it's safe to drop the old photo. A failure here only
    // orphans a file; it must never fail a request that already succeeded.
    if (replaced.url) {
      await getStorageAdapter().delete(replaced.url).catch((err) => {
        console.error(`Failed to delete previous patient image ${replaced.url}`, err);
      });
    }

    return saved;
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