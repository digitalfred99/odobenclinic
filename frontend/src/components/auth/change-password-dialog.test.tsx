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
