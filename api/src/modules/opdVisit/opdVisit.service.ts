import { validateCreateOPDVisit, validateUpdateOPDVisit } from "@/modules/opdVisit/opdVisit.validator";
import { validate as isUUID } from "uuid";
import { Brackets, In, EntityManager } from "typeorm";
import { AppDataSource } from "@/database/data-source";
import { OPDVisit, NewReturning } from "@/database/entities/OPDVisit";
import { CreateOPDVisitDTO, FilterOPDVisitDTO, UpdateOPDVisitDTO } from "@/types/opdVisit.type";
import { CustomAppError } from "@/lib/errors/customAppError";
import { ErrorCodes } from "@/lib/errors/errorCodes";
import { buildPaginationMeta, parsePagination } from "@/lib/http/pagination";
import { PaginationQuery } from "@/types/pagination.type";
import { Patient } from "@/database/entities/Patient";
import { User } from "@/database/entities/User";
import { writeAuditLog } from "@/lib/audit/writeAuditLog";
import { AuditAction, AuditEntityType } from "@/lib/audit/auditActions";

export class OPDVisitService {

  private static async repo() {
    const db = await AppDataSource();
    return db.getRepository(OPDVisit);
  }

  static async getOPDVisits(filters: FilterOPDVisitDTO & PaginationQuery) {
      const repo = await this.repo();
      const opdVisitsQuery = repo
        .createQueryBuilder("opdVisit")
        .leftJoinAndSelect("opdVisit.patient", "patient")
        .leftJoin("opdVisit.createdBy", "createdBy")
        .addSelect(["createdBy.id", "createdBy.firstName", "createdBy.lastName"])
        .where("opdVisit.isDeleted = :isDeleted", { isDeleted: false });

      if (filters.patientId) {
        opdVisitsQuery.andWhere("patient.id = :patientId", { patientId: filters.patientId });
      }
      if (filters.dateFrom) {
        opdVisitsQuery.andWhere("opdVisit.date >= :dateFrom", { dateFrom: filters.dateFrom });
      }
      if (filters.dateTo) {
        opdVisitsQuery.andWhere("opdVisit.date <= :dateTo", { dateTo: filters.dateTo });
      }

      // There is no per-visit number to search on anymore — the clinic's
      // OPD number is the (fixed, permanent) patient.patientId. So a
      // search hits the visit's own date/remarks and the linked
      // patient's name/patientId.
      const searchTerms = filters.search?.trim().split(/\s+/).filter(Boolean) ?? [];
      searchTerms.forEach((term, index) => {
        const parameter = `searchTerm${index}`;
        const pattern = `%${term}%`;

        opdVisitsQuery.andWhere(
          new Brackets((searchQuery) => {
            searchQuery
              // date is a date column — ILIKE on it directly throws in
              // Postgres ("operator does not exist"). Cast to text first
              // so free-text search still works.
              .where(`CAST(opdVisit.date AS TEXT) ILIKE :${parameter}`, { [parameter]: pattern })
              .orWhere(`patient.firstName ILIKE :${parameter}`, { [parameter]: pattern })
              .orWhere(`patient.lastName ILIKE :${parameter}`, { [parameter]: pattern })
              .orWhere(`patient.patientId ILIKE :${parameter}`, { [parameter]: pattern })
          })
        );
      });

      const { page, limit, skip, take } = parsePagination({
        page: filters.page?.toString(),
        limit: filters.limit?.toString(),
      });

      const [opdVisits, count] = await opdVisitsQuery
        .orderBy("opdVisit.createdAt", "DESC")
        .skip(skip)
        .take(take)
        .getManyAndCount();

      return { opdVisits: opdVisits, pagination: buildPaginationMeta(count, page, limit) };
  }

  static async getOPDVisit(id: string) {
    if (!id || !isUUID(id)) {
      throw new CustomAppError("Valid OPDVisit ID is required", 400, ErrorCodes.ID_REQUIRED.code, ErrorCodes.ID_REQUIRED.label, "bad_request");
    }

    const repo = await this.repo();

    // createdBy is deliberately limited to id + name: loading the full
    // User relation would return its passwordHash to every caller.
    const opdVisit = await repo
      .createQueryBuilder("opdVisit")
      .leftJoinAndSelect("opdVisit.patient", "patient")
      .leftJoin("opdVisit.createdBy", "createdBy")
      .addSelect(["createdBy.id", "createdBy.firstName", "createdBy.lastName"])
      .where("opdVisit.id = :id", { id })
      .andWhere("opdVisit.isDeleted = :isDeleted", { isDeleted: false })
      .getOne();

    if (!opdVisit) {
      throw new CustomAppError("No OPDVisit found with the given ID", 404, ErrorCodes.RECORD_NOT_FOUND.code, ErrorCodes.RECORD_NOT_FOUND.label, "opdVisit_not_found");
    }

    return opdVisit;
  }

  private static todayAsDateString(): string {
    return new Date().toISOString().slice(0, 10);
  }

  static async create(data: CreateOPDVisitDTO, createdById: string) {
    validateCreateOPDVisit(data);

    const db = await AppDataSource();
    const patientRepo = db.getRepository(Patient)
    const userRepo = db.getRepository(User)

    const [ patient, createdBy ] = await Promise.all([
      patientRepo.findOne({ where: {id: data.patient, isDeleted: false} }),
      userRepo.findOne({ where: {id: createdById, isDeleted: false, isActive: true} }),
    ])

    if(!patient) throw new CustomAppError("No Patient found with the given ID", 404, ErrorCodes.RECORD_NOT_FOUND.code, ErrorCodes.RECORD_NOT_FOUND.label, "patient_not_found");
    if(!createdBy) throw new CustomAppError("No authorized user found to create this record", 404, ErrorCodes.UNAUTHORIZED_ACCESS.code, ErrorCodes.UNAUTHORIZED_ACCESS.label, "user_not_authorized");

    return db.transaction(async (manager: EntityManager) => {
      const repo = manager.getRepository(OPDVisit);

      // Decide new-vs-returning once, at creation time, from whether
      // this patient has any earlier non-deleted visit. See the
      // comment on OPDVisit.newReturning for why this is stored
      // rather than recomputed on every read.
      const priorVisitCount = await repo.count({
        where: { patient: { id: patient.id }, isDeleted: false },
      });

      const newOPDVisit = repo.create({
        date: data.date ?? this.todayAsDateString(),
        remarks: data.remarks || undefined,
        patient,
        createdBy,
        newReturning: priorVisitCount === 0 ? NewReturning.NEW : NewReturning.RETURNING,
      });

      const savedVisit = await repo.save(newOPDVisit);

      await writeAuditLog(
        {
          actorUserId: createdById,
          action: AuditAction.OPD_VISIT_CREATED,
          entityType: AuditEntityType.OPDVISIT,
          entityId: savedVisit.id,
          metadata: { patientId: patient.patientId, newReturning: savedVisit.newReturning },
        },
        manager
      );

      // Don't echo the full User entity (passwordHash) back in the response.
      return {
        ...savedVisit,
        patient,
        createdBy: { id: createdBy.id, firstName: createdBy.firstName, lastName: createdBy.lastName },
      };
    });
  }

  static async update(id: string, data: UpdateOPDVisitDTO, actorUserId?: string) {
    if (!id || !isUUID(id)) {
      throw new CustomAppError("Valid OPDVisit ID is required", 400, ErrorCodes.ID_REQUIRED.code, ErrorCodes.ID_REQUIRED.label, "bad_request");
    }

    validateUpdateOPDVisit(data);

    const db = await AppDataSource();

    return db.transaction(async (manager: EntityManager) => {
      const repo = manager.getRepository(OPDVisit);

      const existingOPDVisit = await repo.findOne({
        where: { id, isDeleted: false }
      });

      if(!existingOPDVisit) throw new CustomAppError("No OPDVisit found with the given ID", 404, ErrorCodes.RECORD_NOT_FOUND.code, ErrorCodes.RECORD_NOT_FOUND.label, "opdvisit_not_found");

      const updatedOPDVisit = repo.merge(existingOPDVisit, data);
      const savedVisit = await repo.save(updatedOPDVisit);

      await writeAuditLog(
        {
          actorUserId,
          action: AuditAction.OPD_VISIT_UPDATED,
          entityType: AuditEntityType.OPDVISIT,
          entityId: savedVisit.id,
          metadata: { changedFields: Object.keys(data) },
        },
        manager
      );

      return savedVisit;
    });
  }

  static async delete(ids: string[], actorUserId?: string) {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new CustomAppError("Invalid request IDs", 400, ErrorCodes.ID_REQUIRED.code, ErrorCodes.ID_REQUIRED.label, "bad_request");
    }

    const db = await AppDataSource();

    return db.transaction(async (manager: EntityManager) => {
      const repo = manager.getRepository(OPDVisit);

      const records = await repo.find({
        where: { id: In(ids), isDeleted: false },
        relations: {patient: true},
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
            action: AuditAction.OPD_VISIT_DELETED,
            entityType: AuditEntityType.OPDVISIT,
            entityId: record.id,
            metadata: { patientId: record.patient.patientId },
          },
          manager
        );
      }

      return savedRecords;
    });
  }
}
