export const PASSWORD_STRENGTH_MESSAGE =
  "Use at least 8 characters, including one number and one special character.";

export function isStrongPassword(password: string): boolean {
  return password.length >= 8 && /\d/.test(password) && /[^A-Za-z0-9]/.test(password);
}
