import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api";
import LoginPage from "./page";

const authState = vi.hoisted(() => ({ login: vi.fn() }));
const navigation = vi.hoisted(() => ({ replace: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => navigation,
}));

vi.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => ({ login: authState.login }),
}));

vi.mock("@/lib/api", () => ({
  ApiError: class extends Error {
    code: string;
    constructor(message: string, _status: number, code: string) {
      super(message);
      this.code = code;
    }
  },
}));

vi.mock("@/lib/support-contact", () => ({
  supportPhone: "0551234567",
  supportEmail: "help@example.test",
}));

describe("login deactivation support", () => {
  it("shows configured support channels for an inactive staff account", async () => {
    authState.login.mockRejectedValueOnce(new ApiError("This account is deactivated.", 403, "GNE_E0301"));
    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText("Phone"), { target: { value: "0241234567" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "some-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This staff account is currently inactive. Please contact the clinic to restore access."
    );
    expect(screen.getByRole("link", { name: "Call 0551234567" })).toHaveAttribute("href", "tel:0551234567");
    expect(screen.getByRole("link", { name: "Email help@example.test" })).toHaveAttribute("href", "mailto:help@example.test");
  });

  it("continues to show ordinary login errors without support details", async () => {
    authState.login.mockRejectedValueOnce(new Error("Invalid phone number or password"));
    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText("Phone"), { target: { value: "0241234567" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "some-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Invalid phone number or password")).toBeInTheDocument();
    expect(screen.queryByText(/contact the clinic to restore access/)).not.toBeInTheDocument();
  });
});
