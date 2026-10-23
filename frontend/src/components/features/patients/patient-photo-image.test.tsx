import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PatientPhotoImage } from "./patient-photo-image";

describe("PatientPhotoImage", () => {
  it("shows the avatar fallback when the photo fails to load", () => {
    render(
      <PatientPhotoImage
        src="/uploads/patients/missing.jpg"
        alt="Patient photo"
        width={96}
        height={96}
        className="h-24 w-24 rounded-xl"
      />
    );

    fireEvent.error(screen.getByRole("img", { name: "Patient photo" }));

    const fallback = screen.getByRole("img", { name: "Patient photo unavailable" });
    expect(fallback).toHaveClass("h-24", "w-24", "rounded-xl", "bg-primary/10");
    expect(fallback.querySelector("svg")).toBeInTheDocument();
  });

  it("retries with the avatar photo when the image source changes", () => {
    const { rerender } = render(
      <PatientPhotoImage src="/uploads/patients/old.jpg" alt="Patient photo" width={96} height={96} />
    );
    fireEvent.error(screen.getByRole("img", { name: "Patient photo" }));
    expect(screen.getByRole("img", { name: "Patient photo unavailable" })).toBeInTheDocument();

    rerender(
      <PatientPhotoImage src="/uploads/patients/new.jpg" alt="Patient photo" width={96} height={96} />
    );

    expect(screen.getByRole("img", { name: "Patient photo" })).toHaveAttribute(
      "src",
      expect.stringContaining("/uploads/patients/new.jpg")
    );
  });

  it("fills its container when a fill image fails", () => {
    render(<PatientPhotoImage src="/uploads/patients/missing.jpg" alt="Patient photo" fill />);

    fireEvent.error(screen.getByRole("img", { name: "Patient photo" }));

    expect(screen.getByRole("img", { name: "Patient photo unavailable" })).toHaveClass(
      "absolute",
      "inset-0",
      "h-full",
      "w-full"
    );
  });
});
