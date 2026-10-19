export const patientFullName = (p: { firstName: string; otherName?: string | null; lastName: string }) =>
  [p.firstName, p.otherName, p.lastName].filter(Boolean).join(" ");