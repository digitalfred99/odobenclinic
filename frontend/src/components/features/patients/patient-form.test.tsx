import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/dynamic", () => ({
  default: () => () => null,
}));

import { PatientForm } from "./patient-form";

describe("PatientForm defaults and guidance", () => {
  it("defaults new patients to Central Region, Asikuma-Odoben-Brakwa, and Odoben", () => {
    render(<PatientForm onSubmit={vi.fn()} />);

    expect(screen.getByLabelText("Region")).toHaveValue("Central Region");
    expect(screen.getByLabelText("District")).toHaveValue("Asikuma-Odoben-Brakwa");
    expect(screen.getByLabelText("Town")).toHaveValue("Odoben");

    fireEvent.click(screen.getByRole("button", { name: "Show area suggestions" }));
    expect(screen.getByRole("option", { name: "Awendadze" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("option", { name: "Awendadze" }));
    expect(screen.getByLabelText("Area")).toHaveValue("Awendadze");
  });

  it("marks required labels and describes a manually entered age", () => {
    render(<PatientForm onSubmit={vi.fn()} />);

    for (const label of ["First name", "Last name", "Date of birth", "Age", "Gender", "Marital status"]) {
      expect(screen.getByText(label).querySelector("span.text-destructive")).toBeInTheDocument();
    }

    fireEvent.change(screen.getByLabelText(/^Age/), { target: { value: "38" } });
    expect(screen.getByText("Manually entered")).toBeInTheDocument();
    expect(screen.queryByText(/Auto-calculated age/)).not.toBeInTheDocument();
  });

  it("shows an optional other-name field", () => {
    render(<PatientForm onSubmit={vi.fn()} />);

    expect(screen.getByLabelText("Other name")).toBeInTheDocument();
  });

  it("allows a user to type a custom district", () => {
    render(<PatientForm onSubmit={vi.fn()} />);

    const district = screen.getByLabelText("District");
    fireEvent.change(district, { target: { value: "Custom District" } });

    expect(district).toHaveValue("Custom District");
  });

  it("shows all location suggestions when the mobile-friendly dropdown is tapped", () => {
    render(<PatientForm onSubmit={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Show district suggestions" }));

    expect(screen.getByRole("option", { name: "Abura-Asebu-Kwamankese" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Agona West" })).toBeInTheDocument();
  });

  it("selects district and town suggestions and updates dependent location fields", () => {
    render(<PatientForm onSubmit={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Show district suggestions" }));
    fireEvent.click(screen.getByRole("option", { name: "Agona West" }));
    expect(screen.getByLabelText("District")).toHaveValue("Agona West");
    expect(screen.getByLabelText("Town")).toHaveValue("");

    fireEvent.change(screen.getByLabelText("District"), { target: { value: "Asikuma-Odoben-Brakwa" } });
    fireEvent.click(screen.getByRole("button", { name: "Show town suggestions" }));
    fireEvent.click(screen.getByRole("option", { name: "Odoben" }));
    expect(screen.getByLabelText("Town")).toHaveValue("Odoben");
  });

  it("opens and selects location suggestions with the keyboard", () => {
    render(<PatientForm onSubmit={vi.fn()} />);

    const district = screen.getByLabelText("District");
    fireEvent.focus(district);
    fireEvent.change(district, { target: { value: "Agona" } });
    fireEvent.keyDown(district, { key: "ArrowDown" });
    fireEvent.keyDown(district, { key: "Enter" });

    expect(district).toHaveValue("Agona West");
  });

  it("rejects a nonzero first digit and explains the required format inline", () => {
    render(<PatientForm onSubmit={vi.fn()} />);

    const phone = screen.getByLabelText("Phone");
    fireEvent.change(phone, { target: { value: "1" } });
    expect(phone).toHaveValue("");
    expect(screen.getByText("Phone numbers must start with 0.")).toBeInTheDocument();

    const validPhone = "0".repeat(10);
    fireEvent.change(phone, { target: { value: validPhone } });
    expect(phone).toHaveValue(validPhone);
    expect(screen.queryByText("Phone numbers must start with 0.")).not.toBeInTheDocument();
  });
});
