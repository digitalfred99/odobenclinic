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
    expect(screen.getByLabelText(/Password/, { selector: "input" })).toBeRequired();
    expect(screen.getByLabelText(/Role/)).toBeRequired();
    expect(screen.getByLabelText("Email")).not.toBeRequired();
    expect(screen.getByRole("region", { name: "Password requirements" })).toBeInTheDocument();
    expect(screen.getByText("At least one lowercase letter")).toBeInTheDocument();
    expect(screen.getByText("At least one uppercase letter")).toBeInTheDocument();
    expect(screen.queryByText("Create a password that meets each requirement below.")).not.toBeInTheDocument();
    expect(screen.queryByText("Password checklist")).not.toBeInTheDocument();
    expect(screen.queryByText("Tick off each item as you go.")).not.toBeInTheDocument();
    expect(screen.queryByText("No spaces or whitespace")).not.toBeInTheDocument();
    expect(screen.queryByText("No more than 72 characters")).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Password requirements" }))
      .not.toHaveClass("border", "bg-muted/50");
  });

  it("marks password requirements green as they are met", async () => {
    renderUsersPage();
    await screen.findByText("No users match the current filters.");

    fireEvent.change(screen.getByLabelText(/Password/, { selector: "input" }), { target: { value: "Clinic123!" } });

    expect(screen.getByText("At least 8 characters").closest("li")).toHaveClass("text-success");
    expect(screen.getByText("At least one lowercase letter").closest("li")).toHaveClass("text-success");
    expect(screen.getByText("At least one uppercase letter").closest("li")).toHaveClass("text-success");
    expect(screen.getByText("At least one number").closest("li")).toHaveClass("text-success");
    expect(screen.getByText("At least one special character").closest("li")).toHaveClass("text-success");
    expect(screen.getByText("All set! This password is ready.")).toBeInTheDocument();
  });

  it.each([
    ["a password containing a space", "Strong Pass1!"],
    ["a password longer than 72 characters", `${"a".repeat(71)}A1!`],
  ])("does not show the ready message for %s", async (_description, password) => {
    renderUsersPage();
    await screen.findByText("No users match the current filters.");

    fireEvent.change(screen.getByLabelText(/Password/, { selector: "input" }), { target: { value: password } });

    expect(screen.queryByText("All set! This password is ready.")).not.toBeInTheDocument();
  });

  it("shows the shared phone-format message and prevents an invalid user request", async () => {
    renderUsersPage();
    await screen.findByText("No users match the current filters.");

    fireEvent.change(screen.getByLabelText(/First name/), { target: { value: "Clinic" } });
    fireEvent.change(screen.getByLabelText(/Last name/), { target: { value: "Staff" } });
    fireEvent.change(screen.getByLabelText(/Phone/), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText(/Password/, { selector: "input" }), { target: { value: "StrongPass1!" } });
    expect(screen.getByText("Phone numbers must start with 0.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Create user" }));

    expect(await screen.findByText("Phone numbers must start with 0.")).toBeInTheDocument();
    expect(apiRequest).not.toHaveBeenCalledWith("/users", expect.objectContaining({ method: "POST" }));
  });

  it("shows backend password validation errors beside the create password field", async () => {
    vi.mocked(apiRequest)
      .mockResolvedValueOnce({
        users: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
      })
      .mockRejectedValueOnce(new Error("password must not contain a commonly used phrase"));
    renderUsersPage();
    await screen.findByText("No users match the current filters.");

    fireEvent.change(screen.getByLabelText(/First name/), { target: { value: "Clinic" } });
    fireEvent.change(screen.getByLabelText(/Last name/), { target: { value: "Staff" } });
    fireEvent.change(screen.getByLabelText(/Phone/), { target: { value: "0241234567" } });
    fireEvent.change(screen.getByLabelText(/Password/, { selector: "input" }), { target: { value: "StrongPass1!" } });
    fireEvent.click(screen.getByRole("button", { name: "Create user" }));

    expect(await screen.findByText("password must not contain a commonly used phrase")).toBeInTheDocument();
    expect(screen.getByLabelText(/Password/, { selector: "input" })).toHaveAttribute("aria-invalid", "true");
  });

  it("shows a specific frontend error for spaces without calling the API", async () => {
    renderUsersPage();
    await screen.findByText("No users match the current filters.");

    fireEvent.change(screen.getByLabelText(/First name/), { target: { value: "Clinic" } });
    fireEvent.change(screen.getByLabelText(/Last name/), { target: { value: "Staff" } });
    fireEvent.change(screen.getByLabelText(/Phone/), { target: { value: "0241234567" } });
    fireEvent.change(screen.getByLabelText(/Password/, { selector: "input" }), { target: { value: "Strong Pass1!" } });

    expect(screen.getByText("At least 8 characters").closest("li")).toHaveClass("text-success");
    expect(screen.getByText("At least one lowercase letter").closest("li")).toHaveClass("text-success");
    expect(screen.getByText("At least one uppercase letter").closest("li")).toHaveClass("text-success");
    expect(screen.getByText("At least one number").closest("li")).toHaveClass("text-success");
    expect(screen.getByText("At least one special character").closest("li")).toHaveClass("text-success");
    fireEvent.click(screen.getByRole("button", { name: "Create user" }));

    expect(await screen.findByText("Password must not contain spaces.")).toBeInTheDocument();
    expect(apiRequest).not.toHaveBeenCalledWith("/users", expect.objectContaining({ method: "POST" }));
  });

  it("shows a specific frontend error for passwords over 72 characters", async () => {
    renderUsersPage();
    await screen.findByText("No users match the current filters.");

    fireEvent.change(screen.getByLabelText(/First name/), { target: { value: "Clinic" } });
    fireEvent.change(screen.getByLabelText(/Last name/), { target: { value: "Staff" } });
    fireEvent.change(screen.getByLabelText(/Phone/), { target: { value: "0241234567" } });
    fireEvent.change(screen.getByLabelText(/Password/, { selector: "input" }), {
      target: { value: `${"a".repeat(71)}A1!` },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create user" }));

    expect(await screen.findByText("Password must not exceed 72 characters.")).toBeInTheDocument();
    expect(apiRequest).not.toHaveBeenCalledWith("/users", expect.objectContaining({ method: "POST" }));
    expect(screen.queryByRole("alert", { name: /Unable to save user/ })).not.toBeInTheDocument();
  });

  it("lets staff reveal and hide a password while typing", async () => {
    renderUsersPage();
    await screen.findByText("No users match the current filters.");

    const password = screen.getByLabelText(/Password/, { selector: "input" });
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
