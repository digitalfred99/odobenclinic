import type { UserRole } from "@/database/entities/User";

// ── Login ───────────────────────────────────────────────────────
export type LoginDTO = {
  phone: string;
  password: string;
};
export type RefreshDTO = { refreshToken: string };
