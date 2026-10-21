import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PatientAvatar } from "./patient-avatar";
import type { Patient } from "@/types/patient";

const patient: Patient = {
  id: "patient-uuid",
  firstName: "Ama",
  lastName: "Mensah",
};

describe("PatientAvatar", () => {
  it("shows the patient photo when available", () => {
    const { container } = render(
      <PatientAvatar patient={{ ...patient, imageUrl: "/uploads/patients/ama.jpg" }} size="small" />
    );

    expect(container.querySelector("img")).toHaveAttribute("src", expect.stringContaining("/uploads/patients/ama.jpg"));
    expect(container.querySelector("svg")).not.toBeInTheDocument();
  });

  it("uses the profile symbol when there is no photo or the photo fails to load", () => {
    const { container, rerender } = render(<PatientAvatar patient={patient} size="small" />);

    expect(container.querySelector("svg")).toBeInTheDocument();
    expect(container.querySelector("img")).not.toBeInTheDocument();

    rerender(<PatientAvatar patient={{ ...patient, imageUrl: "/uploads/patients/unavailable.jpg" }} size="small" />);
    const image = container.querySelector("img");
    expect(image).toBeInTheDocument();
    if (!image) throw new Error("Expected the patient photo to render.");
    fireEvent.error(image);

    expect(container.querySelector("img")).not.toBeInTheDocument();
    expect(container.querySelector("svg")).toBeInTheDocument();
  });
});
