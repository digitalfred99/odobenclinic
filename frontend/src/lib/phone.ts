export function sanitizePhoneNumber(value: string): string {
  return value.replace(/\D/g, "").slice(0, 10);
}

export function isTenDigitPhoneNumber(value: string): boolean {
  return /^\d{10}$/.test(value);
}