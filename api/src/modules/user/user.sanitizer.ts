import { UpdateUserDTO, CreateUserDTO } from "@/types/user.type";

export class UserSanitizer {
  private static readonly CREATABLE_FIELDS = [
    "firstName",
    "lastName",
    "email",
    "password",
    "phone",
    "role",
  ] as const;

  private static readonly UPDATABLE_FIELDS = [
    "firstName",
    "lastName",
    "phone",
    "email",
    "password",
  ] as const;

  private static pick(data: unknown, fields: readonly string[]): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};
    if (!data || typeof data !== "object") return sanitized;
    for (const key of fields) {
      const value = (data as Record<string, unknown>)[key];
      if (value !== undefined) sanitized[key] = value;
    }
    return sanitized;
  }

  static create(data: unknown): CreateUserDTO {
    return UserSanitizer.pick(data, UserSanitizer.CREATABLE_FIELDS) as CreateUserDTO;
  }

  static update(data: unknown): UpdateUserDTO {
    return UserSanitizer.pick(data, UserSanitizer.UPDATABLE_FIELDS) as UpdateUserDTO;
  }
}
