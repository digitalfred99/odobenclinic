export type UserRole = "super_admin" | "admin" | "receptionist";

export type AuthUser = {
  id: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  role: UserRole;
  isActive: boolean;
};

export function displayRoleLabel(role?: UserRole | null): string {
  if (!role) {
    return "Receptionist";
  }

  if (role === "super_admin") {
    return "Admin";
  }

  return role === "admin" ? "Admin" : "Receptionist";
}

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

export type LoginResponse = AuthTokens & {
  user: AuthUser;
};

export type RefreshResponse = {
  accessToken: string;
  refreshToken: string;
};
