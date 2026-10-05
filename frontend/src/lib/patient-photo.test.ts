import { describe, expect, it } from "vitest";
import { MAX_PATIENT_PHOTO_SIZE, validatePatientPhoto } from "@/lib/patient-photo";

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
