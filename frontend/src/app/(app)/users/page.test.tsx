import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "@/lib/api";
import UsersPage from "./page";

vi.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => ({ user: { id: "admin-1", role: "admin" }, logout: vi.fn() }),
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
  HTMLElement.prototype.scrollIntoView = vi.fn();
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

  it("shows the shared phone-format message and prevents an invalid user request", async () => {
    renderUsersPage();
    await screen.findByText("No users match the current filters.");

    fireEvent.change(screen.getByLabelText(/First name/), { target: { value: "Clinic" } });
    fireEvent.change(screen.getByLabelText(/Last name/), { target: { value: "Staff" } });
    fireEvent.change(screen.getByLabelText(/Phone/), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText(/Password/), { target: { value: "StrongPass1!" } });
    expect(screen.getByText("Phone numbers must start with 0.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Create user" }));

    expect(await screen.findByText("Phone numbers must start with 0.")).toBeInTheDocument();
    expect(apiRequest).not.toHaveBeenCalledWith("/users", expect.objectContaining({ method: "POST" }));
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

  it("hides password reset for your own account and omits password from its update", async () => {
    vi.mocked(apiRequest).mockResolvedValueOnce({
      users: [{
        id: "admin-1",
        firstName: "Clinic",
        lastName: "Admin",
        role: "admin",
        isActive: true,
      }],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    renderUsersPage();
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));

    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Change password" }));
    expect(screen.getByLabelText("Current password")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await vi.waitFor(() => {
      const patchCall = vi.mocked(apiRequest).mock.calls.find(([, init]) => init?.method === "PATCH");
      expect(patchCall).toBeDefined();
      expect(JSON.parse(String(patchCall?.[1]?.body))).not.toHaveProperty("password");
    });
  });

  it("allows an admin to reset another user's password only when a value is entered", async () => {
    vi.mocked(apiRequest).mockResolvedValueOnce({
      users: [{
        id: "receptionist-1",
        firstName: "Clinic",
        lastName: "Receptionist",
        role: "receptionist",
        isActive: true,
      }],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    renderUsersPage();
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    expect(screen.getByLabelText("Reset user's password")).toBeInTheDocument();
    expect(screen.getByText("The user will be signed out of all devices.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Reset user's password"), { target: { value: "Resetpass1!" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText("User updated successfully.")).toBeInTheDocument();
    await vi.waitFor(() => {
      const patchCalls = vi.mocked(apiRequest).mock.calls.filter(([, init]) => init?.method === "PATCH");
      expect(JSON.parse(String(patchCalls.at(-1)?.[1]?.body))).toHaveProperty("password", "Resetpass1!");
    });
  });
});
