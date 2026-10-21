import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, changePassword } from "@/lib/api";
import { setSignInNotice } from "@/lib/session";
import { ChangePasswordDialog } from "./change-password-dialog";

const authState = vi.hoisted(() => ({ logout: vi.fn() }));

vi.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => ({ logout: authState.logout }),
}));

vi.mock("@/lib/api", () => ({
  ApiError: class extends Error {
    status: number;
    code?: string;
    constructor(message: string, status: number, code?: string) {
      super(message);
      this.status = status;
      this.code = code;
    }
  },
  changePassword: vi.fn(),
}));

vi.mock("@/lib/session", () => ({
  setSignInNotice: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(changePassword).mockReset();
  vi.mocked(setSignInNotice).mockReset();
  authState.logout.mockReset().mockResolvedValue(undefined);
});

function renderDialog() {
  return render(<ChangePasswordDialog open onOpenChange={vi.fn()} />);
}

function fillPasswordFields() {
  fireEvent.change(screen.getByLabelText("Current password"), { target: { value: "Current1!" } });
  fireEvent.change(screen.getByLabelText("New password"), { target: { value: "Newpass2!" } });
  fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: "Newpass2!" } });
}

describe("change password dialog", () => {
  it("shows an invalid current password inline without logging out", async () => {
    vi.mocked(changePassword).mockRejectedValueOnce(new ApiError("Current password is incorrect.", 401, "invalid_current_password"));
    renderDialog();
    fillPasswordFields();
    fireEvent.click(screen.getByRole("button", { name: "Change password" }));

    expect(await screen.findByText("Current password is incorrect.")).toBeInTheDocument();
    expect(authState.logout).not.toHaveBeenCalled();
    expect(setSignInNotice).not.toHaveBeenCalled();
  });

  it("saves the new password and signs the user out", async () => {
    vi.mocked(changePassword).mockResolvedValueOnce({
      success: true,
      code: "RECORD_UPDATED",
      message: "Record updated successfully.",
    });
    renderDialog();
    fillPasswordFields();
    fireEvent.click(screen.getByRole("button", { name: "Change password" }));

    expect(await vi.waitFor(() => expect(setSignInNotice).toHaveBeenCalledWith("Password changed. Please sign in again.")));
    expect(changePassword).toHaveBeenCalledWith({ currentPassword: "Current1!", newPassword: "Newpass2!" });
    expect(authState.logout).toHaveBeenCalledOnce();
  });

  it("shows live requirements that match the auth password validator", () => {
    renderDialog();

    const requirements = screen.getByRole("region", { name: "Password requirements" });
    expect(requirements).toBeInTheDocument();
    expect(requirements).not.toHaveClass("border", "bg-muted/50");
    expect(screen.getByText("At least 8 characters")).toBeInTheDocument();
    expect(screen.getByText("At least one lowercase letter")).toBeInTheDocument();
    expect(screen.getByText("At least one uppercase letter")).toBeInTheDocument();
    expect(screen.getByText("At least one number")).toBeInTheDocument();
    expect(screen.getByText("At least one special character")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "Newpass2!" } });

    expect(screen.getByText("All set! This password is ready.")).toBeInTheDocument();
    expect(screen.getByText("At least one number").closest("li")).toHaveClass("text-success");
  });

  it.each([
    ["a password containing a space", "New pass2!"],
    ["a password longer than 72 characters", `${"a".repeat(71)}A1!`],
  ])("does not show the ready message for %s", (_description, password) => {
    renderDialog();

    fireEvent.change(screen.getByLabelText("New password"), { target: { value: password } });

    expect(screen.queryByText("All set! This password is ready.")).not.toBeInTheDocument();
  });

  it("prevents submission until lowercase and uppercase letters are included", () => {
    renderDialog();
    fireEvent.change(screen.getByLabelText("Current password"), { target: { value: "Current1!" } });
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "CLINIC123!" } });
    fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: "CLINIC123!" } });
    fireEvent.click(screen.getByRole("button", { name: "Change password" }));

    expect(screen.getByText("Please meet all password requirements.")).toBeInTheDocument();
    expect(changePassword).not.toHaveBeenCalled();
  });

  it("blocks spaces and passwords over 72 characters before calling the API", () => {
    renderDialog();
    fireEvent.change(screen.getByLabelText("Current password"), { target: { value: "Current1!" } });
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "New pass2!" } });
    fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: "New pass2!" } });
    fireEvent.click(screen.getByRole("button", { name: "Change password" }));

    expect(screen.getByText("Password must not contain spaces.")).toBeInTheDocument();
    expect(changePassword).not.toHaveBeenCalled();

    const tooLongPassword = `${"a".repeat(71)}A1!`;
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: tooLongPassword } });
    fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: tooLongPassword } });
    fireEvent.click(screen.getByRole("button", { name: "Change password" }));

    expect(screen.getByText("Password must not exceed 72 characters.")).toBeInTheDocument();
    expect(changePassword).not.toHaveBeenCalled();
  });

  it("shows backend password validation errors beside the new password field", async () => {
    vi.mocked(changePassword).mockRejectedValueOnce(
      new ApiError("Password does not meet the updated account policy.", 400, "validation_failed")
    );
    renderDialog();
    fillPasswordFields();
    fireEvent.click(screen.getByRole("button", { name: "Change password" }));

    expect(await screen.findByText("Password does not meet the updated account policy.")).toBeInTheDocument();
    expect(screen.getByLabelText("New password")).toHaveAttribute("aria-invalid", "true");
    expect(screen.queryByText("Unable to change password.")).not.toBeInTheDocument();
  });

  it("clears entered passwords when the dialog is closed", () => {
    renderDialog();
    fillPasswordFields();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByLabelText("Current password")).toHaveValue("");
    expect(screen.getByLabelText("New password")).toHaveValue("");
    expect(screen.getByLabelText("Confirm new password")).toHaveValue("");
    expect(screen.getByLabelText("Current password")).toHaveAttribute("type", "password");
  });
});
