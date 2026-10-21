const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 72;
const SPECIAL_CHAR_REGEX = /[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/;
const AUTH_SPECIAL_CHAR_REGEX = /[!@#$%^&*(),.?":{}|<>]/;

export const PASSWORD_STRENGTH_MESSAGE =
  "Please meet all password requirements.";

export type PasswordRequirement = {
  id: string;
  label: string;
  met: boolean;
};

export function getPasswordRequirements(password: string): PasswordRequirement[] {
  const hasPassword = password.length > 0;

  return [
    { id: "min-length", label: "At least 8 characters", met: hasPassword && password.length >= MIN_PASSWORD_LENGTH },
    { id: "lowercase", label: "At least one lowercase letter", met: hasPassword && /[a-z]/.test(password) },
    { id: "uppercase", label: "At least one uppercase letter", met: hasPassword && /[A-Z]/.test(password) },
    { id: "number", label: "At least one number", met: hasPassword && /\d/.test(password) },
    { id: "special-character", label: "At least one special character", met: hasPassword && SPECIAL_CHAR_REGEX.test(password) },
  ];
}

export function getAuthPasswordRequirements(password: string): PasswordRequirement[] {
  const hasPassword = password.length > 0;

  return [
    { id: "min-length", label: "At least 8 characters", met: hasPassword && password.length >= MIN_PASSWORD_LENGTH },
    { id: "lowercase", label: "At least one lowercase letter", met: hasPassword && /[a-z]/.test(password) },
    { id: "uppercase", label: "At least one uppercase letter", met: hasPassword && /[A-Z]/.test(password) },
    { id: "number", label: "At least one number", met: hasPassword && /\d/.test(password) },
    { id: "special-character", label: "At least one special character", met: hasPassword && AUTH_SPECIAL_CHAR_REGEX.test(password) },
  ];
}

export function isStrongPassword(password: string): boolean {
  return (
    getPasswordPolicyError(password) === null &&
    password.length >= MIN_PASSWORD_LENGTH &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /\d/.test(password) &&
    AUTH_SPECIAL_CHAR_REGEX.test(password)
  );
}

export function getPasswordPolicyError(password: string): string | null {
  if (/\s/.test(password)) {
    return "Password must not contain spaces.";
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return "Password must not exceed 72 characters.";
  }
  return null;
}

export function isUserPasswordValid(password: string): boolean {
  return (
    getPasswordPolicyError(password) === null &&
    getPasswordRequirements(password).every((requirement) => requirement.met)
  );
}
