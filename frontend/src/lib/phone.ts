export const PHONE_NUMBER_PLACEHOLDER = "0XXXXXXXXX";

export const PHONE_NUMBER_ERRORS = {
  digitsOnly: "Phone numbers must contain digits only.",
  startsWithZero: "Phone numbers must start with 0.",
  length: "Phone numbers must be 10 digits.",
  required: "Phone number is required.",
} as const;

export function sanitizePhoneNumber(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  return digits && !digits.startsWith("0") ? "" : digits;
}

export function getPhoneNumberError(value: string, required = false): string | null {
  if (value.length === 0) {
    return required ? PHONE_NUMBER_ERRORS.required : null;
  }
  if (!/^\d+$/.test(value)) {
    return PHONE_NUMBER_ERRORS.digitsOnly;
  }
  if (!value.startsWith("0")) {
    return PHONE_NUMBER_ERRORS.startsWithZero;
  }
  if (value.length !== 10) {
    return PHONE_NUMBER_ERRORS.length;
  }
  return null;
}

export function isTenDigitPhoneNumber(value: string): boolean {
  return getPhoneNumberError(value) === null && value.length > 0;
}