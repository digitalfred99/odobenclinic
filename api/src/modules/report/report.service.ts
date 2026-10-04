import { AppDataSource } from "@/database/data-source";
import { Patient } from "@/database/entities/Patient";
import { OPDVisit } from "@/database/entities/OPDVisit";
import { PaginationQuery } from "@/types/pagination.type";
import { buildPaginationMeta, parsePagination } from "@/lib/http/pagination";
import {
  OPDVisitReportFilter,
  OPDVisitReportRow,
  PatientRegistrationReportRow,
  ReportDateRangeFilter,
} from "@/types/report.type";

/**
 * A patient's age at the time of a report is either the explicitly
 * recorded `age`, or — if that's not set — computed from `dateOfBirth`.
 * This mirrors the same "at least one of DOB/age" rule enforced at
 * registration (patient.validator.ts); it is NOT the same thing as a
 * frontend auto-calculating/displaying age live as someone types a DOB
 * into a form (explicitly out of scope per spec section 4/18) — this is
 * a one-time backend computation needed to produce a structured report
 * row at all, since a row with neither value would be useless to the
 * frontend regardless of how it's displayed.
 */
function displayAge(patient: Pick<Patient, "age" | "dateOfBirth">): number | null {
  if (patient.age !== undefined && patient.age !== null) return patient.age;
  if (!patient.dateOfBirth) return null;

  const dob = new Date(patient.dateOfBirth + "T00:00:00.000Z");
  const today = new Date();
  let age = today.getUTCFullYear() - dob.getUTCFullYear();
  const hasHadBirthdayThisYear =
    today.getUTCMonth() > dob.getUTCMonth() ||
    (today.getUTCMonth() === dob.getUTCMonth() && today.getUTCDate() >= dob.getUTCDate());
  if (!hasHadBirthdayThisYear) age -= 1;
  return age;
}

export class ReportService {
  /**
   * "Patient Registration Report" — one row per patient registered in
   * the given window. There's no separate OPD number to join for
   * anymore: the clinic's OPD No. is patient.patientId itself, fixed at
   * registration (see Patient entity).
   */
  static async patientRegistrationReport(filters: ReportDateRangeFilter & PaginationQuery) {
    const db = await AppDataSource();
    const repo = db.getRepository(Patient);

    const query = repo
      .createQueryBuilder("patient")
      .where("patient.isDeleted = :isDeleted", { isDeleted: false });

    if (filters.from) query.andWhere("patient.createdAt >= :from", { from: filters.from });
    if (filters.to) query.andWhere("patient.createdAt < (CAST(:to AS date) + INTERVAL '1 day')", { to: filters.to });
    if (filters.gender) query.andWhere("patient.gender = :gender", { gender: filters.gender });
    if (filters.region) query.andWhere("patient.region ILIKE :region", { region: filters.region });
    if (filters.district) query.andWhere("patient.district ILIKE :district", { district: filters.district });
    if (filters.town) query.andWhere("patient.town ILIKE :town", { town: filters.town });
    if (filters.area) query.andWhere("patient.area ILIKE :area", { area: filters.area });

    const total = await query.getCount();

    const { page, limit, skip, take } = parsePagination({
      page: filters.page?.toString(),
      limit: filters.limit?.toString(),
    });

    const patients = await query
      .orderBy("patient.createdAt", "DESC")
      .skip(skip)
      .take(take)
      .getMany();

    const rows: PatientRegistrationReportRow[] = patients.map((p) => ({
      patientId: p.patientId,
      firstName: p.firstName,
      lastName: p.lastName,
      name: `${p.firstName} ${p.lastName}`,
      dateOfBirth: p.dateOfBirth ?? null,
      age: displayAge(p),
      phone: p.phone ?? null,
      region: p.region ?? null,
      district: p.district ?? null,
      town: p.town ?? null,
      gender: p.gender,
      maritalStatus: p.maritalStatus,
      area: p.area ?? null,
      ghCardNumber: p.ghCardNumber ?? null,
      nhisNumber: p.nhisNumber ?? null,
      dateRegistered: p.createdAt.toISOString(),
    }));

    return { rows, total, pagination: buildPaginationMeta(total, page, limit) };
  }

  /**
   * "OPD Visit Report" — one row per visit in the given window.
   */
  static async opdVisitReport(filters: OPDVisitReportFilter & PaginationQuery) {
    const db = await AppDataSource();
    const repo = db.getRepository(OPDVisit);

    const query = repo
      .createQueryBuilder("visit")
      .leftJoinAndSelect("visit.patient", "patient")
      .where("visit.isDeleted = :isDeleted", { isDeleted: false });

    if (filters.from) query.andWhere("visit.date >= :from", { from: filters.from });
    if (filters.to) query.andWhere("visit.date <= :to", { to: filters.to });
    if (filters.newReturning) query.andWhere("visit.newReturning = :newReturning", { newReturning: filters.newReturning });
    if (filters.gender) query.andWhere("patient.gender = :gender", { gender: filters.gender });
    if (filters.region) query.andWhere("patient.region ILIKE :region", { region: filters.region });
    if (filters.district) query.andWhere("patient.district ILIKE :district", { district: filters.district });
    if (filters.town) query.andWhere("patient.town ILIKE :town", { town: filters.town });
    if (filters.area) query.andWhere("patient.area ILIKE :area", { area: filters.area });

    const total = await query.getCount();

    const { page, limit, skip, take } = parsePagination({
      page: filters.page?.toString(),
      limit: filters.limit?.toString(),
    });

    const visits = await query
      .orderBy("visit.date", "DESC")
      .addOrderBy("visit.createdAt", "DESC")
      .skip(skip)
      .take(take)
      .getMany();

    const rows: OPDVisitReportRow[] = visits.map((visit) => ({
      patientId: visit.patient.patientId,
      name: `${visit.patient.firstName} ${visit.patient.lastName}`,
      age: displayAge(visit.patient),
      gender: visit.patient.gender,
      area: visit.patient.area ?? null,
      date: visit.date,
      newReturning: visit.newReturning,
    }));

    return { rows, total, pagination: buildPaginationMeta(total, page, limit) };
  }
}
