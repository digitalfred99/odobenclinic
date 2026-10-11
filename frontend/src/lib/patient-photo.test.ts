import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getVideoCaptureCrop,
  MAX_PATIENT_PHOTO_SIZE,
  resolvePatientPhotoUrl,
  validatePatientPhoto,
} from "@/lib/patient-photo";

describe("getVideoCaptureCrop", () => {
  it("crops wide video to the camera preview aspect ratio", () => {
    expect(getVideoCaptureCrop(1920, 1080, 4, 3)).toEqual({
      x: 240,
      y: 0,
      width: 1440,
      height: 1080,
    });
  });

  it("crops tall video to the camera preview aspect ratio", () => {
    expect(getVideoCaptureCrop(1080, 1920, 4, 3)).toEqual({
      x: 0,
      y: 555,
      width: 1080,
      height: 810,
    });
  });
});

describe("resolvePatientPhotoUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("resolves relative upload paths against the same-origin proxy", () => {
    const resolved = new URL(resolvePatientPhotoUrl("/uploads/patients/ama.jpg"));

    expect(resolved.pathname).toBe("/uploads/patients/ama.jpg");
    expect(resolved.origin).toBe(window.location.origin);
  });

  it("resolves relative uploads through the frontend origin when using the proxy", () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "/api/v1");

    expect(resolvePatientPhotoUrl("/uploads/patients/ama.jpg")).toBe(
      `${window.location.origin}/uploads/patients/ama.jpg`
    );
  });

  it("preserves absolute photo URLs", () => {
    expect(resolvePatientPhotoUrl("https://images.example.com/ama.jpg")).toBe(
      "https://images.example.com/ama.jpg"
    );
  });
});

describe("validatePatientPhoto", () => {
  it.each(["image/jpeg", "image/png", "image/webp"])("accepts %s", (type) => {
    const photo = new File(["photo"], "patient-photo", { type });
    expect(validatePatientPhoto(photo)).toBeNull();
  });

  it("rejects empty files", () => {
    const photo = new File([], "empty.jpg", { type: "image/jpeg" });
    expect(validatePatientPhoto(photo)).toContain("empty");
  });

  it("rejects files larger than 5 MB", () => {
    const photo = new File([new Uint8Array(MAX_PATIENT_PHOTO_SIZE + 1)], "large.jpg", { type: "image/jpeg" });
    expect(validatePatientPhoto(photo)).toContain("5 MB");
  });

  it("shows the supported-format guidance for HEIC files", () => {
    const photo = new File(["photo"], "patient-photo.heic", { type: "image/heic" });
    expect(validatePatientPhoto(photo)).toBe(
      "This photo format isn't supported. Please take a photo with the camera or use a JPEG/PNG."
    );
  });

  it("rejects unsupported formats", () => {
    const photo = new File(["photo"], "patient-photo.gif", { type: "image/gif" });
    expect(validatePatientPhoto(photo)).toContain("JPEG, PNG, or WebP");
  });
});
