import { CustomAppError } from "@/lib/errors/customAppError";
import { ErrorCodes } from "@/lib/errors/errorCodes";
import { CreateUserDTO, UpdateUserDTO } from "@/types/user.type";
import { UserRole } from "@/database/entities/User";

function fail(message: string): never {
  throw new CustomAppError( message, 400, ErrorCodes.VALIDATION_FAILED.code, ErrorCodes.VALIDATION_FAILED.label, "validation_failed" );
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateCreateUser(data: CreateUserDTO) {
  if (!data.firstName) fail("firstName is required");
  if (!data.lastName) fail("lastName is required");
  if (!data.password) fail("password is required");
  if (!data.phone) fail("phone is required");
  if (data.email){
    if (!EMAIL_REGEX.test(data.email.trim())) fail("email must be a valid email address")
  }
  if (!data.role) fail("role is required");

  validateUserEnum(data);
  validatePasswordStrength(data);
}

export function validateUserEnum(data: any): asserts data is CreateUserDTO {
  if (data.role && !Object.values(UserRole).includes(data.role)) {
    fail(`role must be one of: ${Object.values(UserRole).join(", ")}`);
  }
}

export const validatePasswordStrength = (user: any) => {
  const specialCharsRegex = /[!@#$%^&*(),.?":{}|<>]/;
  const numberRegex = /\d/;
  const password = user.password;

  if (!password) fail("Password is required");

  if (password.length < 8) fail("Password must be at least 8 characters long.");

  if (!numberRegex.test(password)) fail("Password must contain at least one number.");

  if (!specialCharsRegex.test(password)) fail("Password must contain at least one special character.");
};