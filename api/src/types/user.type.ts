import type { UserRole } from "@/database/entities/User";

// Who is performing a user-management action. Always derived from the
// JWT (req.user), never trusted from the request body.
export type UserActor = {
  id: string;
  role: UserRole;
};

// ── Create ───────────────────────────────────────────────────────
// `password` is the plaintext password from the request body; the
// service hashes it before it ever reaches the database. It was
// previously (confusingly, and somewhat riskily) named `passwordHash`
// on this DTO, which made it look like the hash had already been
// computed by the time it got here.
export type CreateUserDTO = {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    phone: string;
    role: UserRole;
};

// ── Update ───────────────────────────────────────────────────────
export type UpdateUserDTO = Partial<{
    firstName: string;
    lastName: string;
    phone: string;
    email: string;
    password: string;
}>;

// ── Filter (list/search) ────────────────────────────────────────
export type FilterUserDTO = {
    search?: string;
    role?: UserRole;
    isActive?: boolean;
};