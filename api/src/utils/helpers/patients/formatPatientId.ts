export const formatPatientId = (year: number, positionInYear: number) =>
  `PT-${positionInYear}/${year}`;