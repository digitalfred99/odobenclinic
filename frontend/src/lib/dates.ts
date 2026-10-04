import { differenceInYears, format, isValid, parseISO } from "date-fns";

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function getDateOfBirthError(dateOfBirth: string, today = new Date().toISOString().slice(0, 10)): string | null {
  if (!ISO_DATE_PATTERN.test(dateOfBirth)) {
    return "Enter the date in YYYY-MM-DD format.";
  }

  const parsedDate = parseISO(dateOfBirth);
  if (!isValid(parsedDate) || format(parsedDate, "yyyy-MM-dd") !== dateOfBirth) {
    return "Enter a valid calendar date.";
  }

  if (dateOfBirth > today) {
    return "Date of birth cannot be in the future.";
  }

  const oldestPossibleDate = new Date(`${today}T00:00:00.000Z`);
  oldestPossibleDate.setUTCFullYear(oldestPossibleDate.getUTCFullYear() - 130);
  if (dateOfBirth < oldestPossibleDate.toISOString().slice(0, 10)) {
    return "Date of birth cannot be more than 130 years ago.";
  }

  return null;
}

export function calculateAge(dateOfBirth?: string | null) {
  if (!dateOfBirth) {
    return null;
  }

  const parsed = parseISO(dateOfBirth);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return differenceInYears(new Date(), parsed);
}

export function toInputDate(date: Date) {
  return date.toISOString().slice(0, 10);
}
