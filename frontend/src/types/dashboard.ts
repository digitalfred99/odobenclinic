export type DashboardSummary = {
  todayOPDVisits: number;
  newPatientsToday: number;
  returningPatientsToday: number;
  totalRegisteredPatients: number;
  recentOPDVisits: RecentOPDVisit[];
};

export type RecentOPDVisit = {
  id: string;
  patientId: string;
  patientName: string;
  date: string;
  newReturning: "new" | "returning";
  registeredBy: string;
};
