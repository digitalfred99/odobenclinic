import { beforeEach, describe, expect, it, vi } from "vitest";
import { changePassword } from "./api";

describe("changePassword API call", () => {
  beforeEach(() => {
    localStorage.setItem("odoben-auth-session", JSON.stringify({
      user: { id: "staff-1" },
      accessToken: "access-token",
      refreshToken: "refresh-token",
    }));
  });

  it("sends the authenticated request and does not refresh on an invalid current password", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(
      JSON.stringify({
        success: false,
        code: "invalid_current_password",
        message: "Current password is incorrect.",
      }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    ));

    await expect(changePassword({ currentPassword: "wrong", newPassword: "Clinic123!" }))
      .rejects.toMatchObject({ status: 401, code: "invalid_current_password" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, request] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("/api/v1/auth/change-password");
    expect(request?.method).toBe("POST");
    expect(new Headers(request?.headers).get("Authorization")).toBe("Bearer access-token");
    expect(new Headers(request?.headers).get("Content-Type")).toBe("application/json");
    expect(request?.body).toBe(JSON.stringify({ currentPassword: "wrong", newPassword: "Clinic123!" }));
    fetchMock.mockRestore();
  });

  it("uses the standard typed response envelope on success", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(
      JSON.stringify({ success: true, code: "RECORD_UPDATED", message: "Record updated successfully." }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    ));

    await expect(changePassword({ currentPassword: "Current1!", newPassword: "Newpass2!" }))
      .resolves.toEqual({ success: true, code: "RECORD_UPDATED", message: "Record updated successfully." });
    vi.restoreAllMocks();
  });
});
