import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "@/lib/api";
import ProfilePage from "./page";

const authState = vi.hoisted(() => ({
  user: { id: "staff-1", firstName: "Clinic", lastName: "Staff", role: "admin" },
  logout: vi.fn(),
}));

vi.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => authState,
}));

vi.mock("@/lib/api", () => ({
  apiRequest: vi.fn().mockResolvedValue(undefined),
  ApiError: class extends Error {},
  changePassword: vi.fn(),
}));

vi.mock("@/lib/session", () => ({
  setSignInNotice: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(apiRequest).mockReset().mockResolvedValue(undefined);
  authState.logout.mockReset();
});

describe("profile page", () => {
  it("associates every profile label with its input and supports browser autofill", () => {
    render(<ProfilePage />);

    expect(screen.getByLabelText("First name")).toHaveAttribute("autocomplete", "given-name");
    expect(screen.getByLabelText("Last name")).toHaveAttribute("autocomplete", "family-name");
    expect(screen.getByLabelText("Email")).toHaveAttribute("autocomplete", "email");
  });

  it("updates profile details without rendering or sending a password field", async () => {
    render(<ProfilePage />);
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));

    await vi.waitFor(() => expect(apiRequest).toHaveBeenCalledOnce());
    const request = vi.mocked(apiRequest).mock.calls[0];
    expect(request?.[0]).toBe("/users/staff-1");
    expect(JSON.parse(String(request?.[1]?.body))).not.toHaveProperty("password");
  });

  it("shows shared phone-format feedback and blocks an invalid profile update", async () => {
    render(<ProfilePage />);

    fireEvent.change(screen.getByLabelText("Phone"), { target: { value: "1" } });
    expect(screen.getByText("Phone numbers must start with 0.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
    expect(await screen.findByText("Phone numbers must start with 0.")).toBeInTheDocument();
    expect(apiRequest).not.toHaveBeenCalled();
  });

  it("offers the change-password dialog from the profile", () => {
    render(<ProfilePage />);
    fireEvent.click(screen.getByRole("button", { name: "Change password" }));
    expect(screen.getByLabelText("Current password")).toBeInTheDocument();
    expect(screen.getByLabelText("New password")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirm new password")).toBeInTheDocument();
  });
});
