export function sanitizePhoneNumber(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length > 0 && digits[0] !== "0") {
    return "";
  }
  return digits.slice(0, 10);
}

export function isTenDigitPhoneNumber(value: string): boolean {
  return /^0\d{9}$/.test(value);
}