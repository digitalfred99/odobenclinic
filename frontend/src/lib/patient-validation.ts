import type { PatientFormValues } from "@/schemas/patient";

export function mapPatientValidationErrorToFields(message: string): Partial<Record<keyof PatientFormValues, string>> {
  const fieldPatterns: Array<[keyof PatientFormValues, RegExp]> = [
    ["firstName", /\bfirstName\b|first name/i],
    ["otherName", /\botherName\b|other name/i],
    ["lastName", /\blastName\b|last name/i],
    ["email", /\bemail\b/i],
    ["postalAddress", /\bpostalAddress\b|postal address/i],
    ["occupation", /\boccupation\b/i],
    ["dateOfBirth", /\bdateOfBirth\b|date of birth/i],
    ["age", /\bage\b/i],
    ["phone", /\bphone\b/i],
    ["ghCardNumber", /\bghCardNumber\b|ghana card/i],
    ["nhisNumber", /\bnhisNumber\b|nhis/i],
    ["region", /\bregion\b/i],
    ["district", /\bdistrict\b/i],
    ["town", /\btown\b/i],
    ["area", /\barea\b/i],
    ["gender", /\bgender\b/i],
    ["maritalStatus", /\bmaritalStatus\b|marital status/i],
    ["religion", /\breligion\b/i],
    ["visitDate", /\bvisit date\b|\bopdVisit\.date\b/i],
    ["visitRemarks", /\bremarks\b/i],
    ["year", /\byear\b/i],
    ["positionInYear", /\bpositionInYear\b|number in year/i],
  ];
  const match = fieldPatterns.find(([, pattern]) => pattern.test(message));
  return match ? { [match[0]]: message } : {};
}
