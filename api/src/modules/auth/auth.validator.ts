import { CustomAppError } from "@/lib/errors/customAppError";
import { ErrorCodes } from "@/lib/errors/errorCodes";
import { ChangePasswordDTO } from "@/types/auth.type";

function fail(message: string): never {
  throw new CustomAppError(message, 400, ErrorCodes.VALIDATION_FAILED.code, ErrorCodes.VALIDATION_FAILED.label, "validation_failed");
}

export function validatePasswordStrength(password: string) {
  const specialCharsRegex = /[!@#$%^&*(),.?":{}|<>]/;
  const numberRegex = /\d/;

  if (!password) fail("Password is required");
  if (password.length < 8) fail("Password must be at least 8 characters long.");
  if (!numberRegex.test(password)) fail("Password must contain at least one number.");
  if (!specialCharsRegex.test(password)) fail("Password must contain at least one special character.");
}


export function validateChangePassword(data: ChangePasswordDTO) {
  if (!data.currentPassword) fail("currentPassword is required");
  if (!data.newPassword) fail("newPassword is required");
  validatePasswordStrength(data.newPassword);
}
