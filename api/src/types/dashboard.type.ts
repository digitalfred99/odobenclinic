// Receptionist dashboard data contracts.
//
// NOTE: this file previously contained types for a completely different
// project (an election/voting app — ElectionStatus, candidate tallies,
// etc.) referencing an `Election` entity that doesn't exist anywhere in
// this codebase. It was dead code that also broke `tsc`/`next build`
// (the import was unresolvable) since this file is covered by the
// tsconfig `include` glob regardless of whether anything imports it.
// Replaced with the receptionist-facing dashboard types this project
// actually needs (spec section 11) — deliberately small: today's OPD
// visit counts, total patients, and a short recent-visits list. Not a
// hospital executive analytics dashboard.

export type ReceptionistDashboardOverview = {
  todayOPDVisits: number;
  newPatientsToday: number;
  returningPatientsToday: number;
  totalRegisteredPatients: number;
  recentOPDVisits: RecentOPDVisitRow[];
};

export type RecentOPDVisitRow = {
  id: string;
  // Same fixed number as the patient's own record — see Patient.patientId.
  patientId: string;
  patientName: string;
  date: string;
  newReturning: "new" | "returning";
  registeredBy: string;
};
