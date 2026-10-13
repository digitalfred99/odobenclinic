import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import LoginPage from "./page";

const authState = vi.hoisted(() => ({ login: vi.fn() }));
const navigation = vi.hoisted(() => ({ replace: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => navigation,
}));

vi.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => ({ login: authState.login }),
}));

describe("login", () => {
  it("shows the same generic error for account-related authentication failures", async () => {
    authState.login.mockRejectedValueOnce(new Error("This account is deactivated."));
    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText("Phone"), { target: { value: "0".repeat(10) } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "some-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Incorrect phone number or password.");
    expect(screen.queryByText(/deactivated/i)).not.toBeInTheDocument();
  });

  it("uses a generic error for incorrect credentials and validates phone format inline", async () => {
    authState.login.mockRejectedValueOnce(new Error("Account not found"));
    render(<LoginPage />);

    const phone = screen.getByLabelText("Phone");
    fireEvent.change(phone, { target: { value: "1" } });
    expect(screen.getByText("Phone numbers must start with 0.")).toBeInTheDocument();
    fireEvent.change(phone, { target: { value: "0".repeat(10) } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "some-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Incorrect phone number or password.");
    expect(screen.queryByText("Account not found")).not.toBeInTheDocument();
  });
});
