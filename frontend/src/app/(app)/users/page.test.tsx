import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "@/lib/api";
import UsersPage from "./page";

vi.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => ({ user: { role: "admin" } }),
}));

vi.mock("@/lib/api", () => ({
  apiRequest: vi.fn().mockResolvedValue({
    users: [],
    pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
  }),
}));

function renderUsersPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <UsersPage />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.mocked(apiRequest).mockReset().mockResolvedValue({
    users: [],
    pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
  });
});

describe("clinic staff form", () => {
  it("marks required creation fields and leaves email optional", async () => {
    renderUsersPage();
    await screen.findByText("No users match the current filters.");

    expect(screen.getByLabelText(/First name/)).toBeRequired();
    expect(screen.getByLabelText(/Last name/)).toBeRequired();
    expect(screen.getByLabelText(/Phone/)).toBeRequired();
    expect(screen.getByLabelText(/Password/)).toBeRequired();
    expect(screen.getByLabelText(/Role/)).toBeRequired();
    expect(screen.getByLabelText("Email")).not.toBeRequired();
    expect(screen.getByText(/At least 8 characters, one number, and one special character/)).toBeInTheDocument();
  });

  it("lets staff reveal and hide a password while typing", async () => {
    renderUsersPage();
    await screen.findByText("No users match the current filters.");

    const password = screen.getByLabelText(/Password/);
    expect(password).toHaveAttribute("type", "password");
    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(password).toHaveAttribute("type", "text");
    fireEvent.click(screen.getByRole("button", { name: "Hide password" }));
    expect(password).toHaveAttribute("type", "password");
  });
});
