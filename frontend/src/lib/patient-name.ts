type PatientNameParts = {
  firstName?: string | null;
  otherName?: string | null;
  lastName?: string | null;
};

export function formatPatientName(patient?: PatientNameParts | null) {
  return [patient?.firstName, patient?.otherName, patient?.lastName]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(" ");
}