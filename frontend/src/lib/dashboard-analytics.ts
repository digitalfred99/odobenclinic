import { format, startOfDay, subDays } from "date-fns";
import type { ReportRow } from "@/types/report";

export type WeeklyVisitDay = {
  date: string;
  label: string;
  newVisits: number;
  returningVisits: number;
  total: number;
};

export function countNewPatientsWithFirstVisit(
  registeredPatients: Pick<ReportRow, "patientId">[],
  firstVisits: Pick<ReportRow, "patientId">[]
) {
  const patientsWithFirstVisit = new Set(firstVisits.map((visit) => visit.patientId));
  return new Set(
    registeredPatients
      .filter((patient) => patientsWithFirstVisit.has(patient.patientId))
      .map((patient) => patient.patientId)
  ).size;
}

export function buildWeeklyVisitSeries(rows: Pick<ReportRow, "date" | "newReturning">[], today = new Date()): WeeklyVisitDay[] {
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = startOfDay(subDays(today, 6 - index));
    return {
      date: format(date, "yyyy-MM-dd"),
      label: format(date, "EEE"),
      newVisits: 0,
      returningVisits: 0,
      total: 0,
    };
  });
  const dayByDate = new Map(days.map((day) => [day.date, day]));

  rows.forEach((row) => {
    if (!row.date || !row.newReturning) return;
    const day = dayByDate.get(row.date.slice(0, 10));
    if (!day) return;
    if (row.newReturning === "new") day.newVisits += 1;
    else day.returningVisits += 1;
    day.total += 1;
  });

  return days;
}
