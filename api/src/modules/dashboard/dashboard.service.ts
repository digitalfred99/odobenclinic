import { AppDataSource } from "@/database/data-source";
import { OPDVisit, NewReturning } from "@/database/entities/OPDVisit";
import { Patient } from "@/database/entities/Patient";
import { ReceptionistDashboardOverview } from "@/types/dashboard.type";

const RECENT_VISITS_LIMIT = 10;

function todayAsDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

// Deliberately simple (spec section 11: "simple and non-cumbersome").
// Today's new/returning counts are derived from OPDVisit.newReturning —
// the flag set once at visit-creation time — rather than from Patient's
// createdAt, so the numbers are self-consistent with each other
// (todayOPDVisits === newPatientsToday + returningPatientsToday) and
// reflect actual attendance today, not just registration timestamps.
export class DashboardService {
  static async receptionistOverview(): Promise<ReceptionistDashboardOverview> {
    const db = await AppDataSource();
    const opdVisitRepo = db.getRepository(OPDVisit);
    const patientRepo = db.getRepository(Patient);

    const today = todayAsDateString();

    const [todayOPDVisits, newPatientsToday, returningPatientsToday, totalRegisteredPatients, recentVisits] =
      await Promise.all([
        opdVisitRepo.count({ where: { isDeleted: false, date: today } }),
        opdVisitRepo.count({ where: { isDeleted: false, date: today, newReturning: NewReturning.NEW } }),
        opdVisitRepo.count({ where: { isDeleted: false, date: today, newReturning: NewReturning.RETURNING } }),
        patientRepo.count({ where: { isDeleted: false } }),
        opdVisitRepo.find({
          where: { isDeleted: false },
          relations: ["patient", "createdBy"],
          order: { createdAt: "DESC" },
          take: RECENT_VISITS_LIMIT,
        }),
      ]);

    return {
      todayOPDVisits,
      newPatientsToday,
      returningPatientsToday,
      totalRegisteredPatients,
      recentOPDVisits: recentVisits.map((visit) => ({
        id: visit.id,
        patientId: visit.patient.patientId,
        patientName: `${visit.patient.firstName} ${visit.patient.lastName}`,
        date: visit.date,
        newReturning: visit.newReturning,
        registeredBy: `${visit.createdBy.firstName} ${visit.createdBy.lastName}`,
      })),
    };
  }
}
