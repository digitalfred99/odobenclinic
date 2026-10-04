export type UserRole = "admin" | "receptionist";

export type ClinicUser = {
  id: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  role: UserRole;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type UsersListResponse = {
  users: ClinicUser[];
  pagination?: {
    total?: number;
    page?: number;
    limit?: number;
    totalPages?: number;
  };
};

export type CreateUserInput = {
  firstName: string;
  lastName: string;
  email?: string;
  password: string;
  phone: string;
  role: UserRole;
};
