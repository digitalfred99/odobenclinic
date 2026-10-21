import { CustomAppError } from "@/lib/errors/customAppError";
import { ErrorCodes } from "@/lib/errors/errorCodes";
import { CreateUserDTO } from "@/types/user.type";
import { UserRole } from "@/database/entities/User";

function fail(message: string): never {
  throw new CustomAppError(
    message,
    400,
    ErrorCodes.VALIDATION_FAILED.code,
    ErrorCodes.VALIDATION_FAILED.label,
    "validation_failed"
  );
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^0\d{9}$/;

const PASSWORD_RULES = {
  minLength: 8,
  maxLength: 72, // bcrypt ignores anything past 72 bytes
};

// OWASP special characters
const SPECIAL_CHAR_REGEX = /[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/;

export function validateCreateUser(data: CreateUserDTO) {
  if (!data.firstName) fail("firstName is required");
  if (!data.lastName) fail("lastName is required");
  if (!data.password) fail("password is required");
  if (!data.phone) fail("phone is required");
  if (!data.role) fail("role is required");

  validatePhone(data.phone);
  validateEmail(data.email);
  validateUserEnum(data);
  validatePasswordStrength(data);
}

export function validatePhone(phone: unknown): asserts phone is string {
  if (typeof phone !== "string" || !PHONE_REGEX.test(phone)) {
    fail("phone must be exactly 10 digits and start with 0");
  }
}

export function validateEmail(email: unknown) {
  if (!email) return; // email is optional
  if (typeof email !== "string" || !EMAIL_REGEX.test(email.trim())) {
    fail("email must be a valid email address");
  }
}

export function validateUserEnum(data: any) {
  if (data.role && !Object.values(UserRole).includes(data.role)) {
    fail(`role must be one of: ${Object.values(UserRole).join(", ")}`);
  }
}

export const validatePasswordStrength = (user: { password?: unknown }) => {
  const password = user.password;

  if (typeof password !== "string" || !password) fail("password is required");

  if (password.length < PASSWORD_RULES.minLength)
    fail(`password must be at least ${PASSWORD_RULES.minLength} characters long`);

  if (password.length > PASSWORD_RULES.maxLength)
    fail(`password must not exceed ${PASSWORD_RULES.maxLength} characters`);

  if (/\s/.test(password)) fail("password must not contain spaces");

  if (!/[a-z]/.test(password)) fail("password must contain at least one lowercase letter");

  if (!/[A-Z]/.test(password)) fail("password must contain at least one uppercase letter");

  if (!/\d/.test(password)) fail("password must contain at least one number");

  if (!SPECIAL_CHAR_REGEX.test(password))
    fail("password must contain at least one special character");
};