import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { toLocalInputDate } from "@/lib/dates";

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

    for (const label of ["First name", "Last name", "Date of birth", "Age", "Gender", "Marital status", "Religion"]) {
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

  it("provides optional contact fields with backend length limits and email autocomplete", () => {
    render(<PatientForm onSubmit={vi.fn()} />);

    expect(screen.getByLabelText("Email")).toHaveAttribute("type", "email");
    expect(screen.getByLabelText("Email")).toHaveAttribute("autocomplete", "email");
    for (const label of ["Email", "Postal address", "Occupation"]) {
      expect(screen.getByLabelText(label)).toHaveAttribute("maxlength", "100");
    }
    expect(screen.getByLabelText(/^Religion/)).toHaveValue("");
  });

  it("places occupation with personal fields and postal address after geographic location", () => {
    render(<PatientForm onSubmit={vi.fn()} />);

    const fields = [
      screen.getByLabelText(/^Religion/),
      screen.getByLabelText("Occupation"),
      screen.getByLabelText("Phone"),
      screen.getByLabelText("Email"),
      screen.getByLabelText("Region"),
      screen.getByLabelText("District"),
      screen.getByLabelText("Town"),
      screen.getByLabelText("Area"),
      screen.getByLabelText("Postal address"),
    ];

    for (let index = 0; index < fields.length - 1; index += 1) {
      expect(
        fields[index].compareDocumentPosition(fields[index + 1]) & Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy();
    }
  });

  it("reports field edits, including cleared values, so server errors can be cleared", () => {
    const onFieldChange = vi.fn();
    render(<PatientForm onSubmit={vi.fn()} onFieldChange={onFieldChange} />);

    fireEvent.change(screen.getByLabelText(/^First name/), { target: { value: "Ama" } });
    expect(onFieldChange).toHaveBeenCalledWith("firstName", "Ama");

    onFieldChange.mockClear();
    fireEvent.change(screen.getByLabelText(/^First name/), { target: { value: "" } });
    expect(onFieldChange).toHaveBeenCalledWith("firstName", "");
  });

  it("requires confirmation before clearing all registration details", () => {
    const onValuesChange = vi.fn();
    render(<PatientForm onSubmit={vi.fn()} onValuesChange={onValuesChange} enablePhoto />);

    fireEvent.change(screen.getByLabelText(/^First name/), { target: { value: "Ama" } });
    fireEvent.click(screen.getByRole("button", { name: "Clear form" }));
    expect(screen.getByRole("dialog", { name: "Clear registration form?" })).toBeInTheDocument();
    expect(screen.getByLabelText(/^First name/)).toHaveValue("Ama");

    fireEvent.click(screen.getByRole("button", { name: "Clear all" }));
    expect(screen.queryByRole("dialog", { name: "Clear registration form?" })).not.toBeInTheDocument();
    expect(screen.getByLabelText(/^First name/)).toHaveValue("");
    expect(onValuesChange).toHaveBeenLastCalledWith(expect.objectContaining({ firstName: "" }));
  });

  it("shows the existing photo and replacement controls in edit mode", () => {
    render(
      <PatientForm
        onSubmit={vi.fn()}
        initialValues={{ firstName: "Ama", lastName: "Mensah", gender: "female", maritalStatus: "single", age: 36 }}
        existingPhotoUrl="/uploads/patients/ama.jpg"
        enablePhoto
      />
    );

    expect(screen.getByRole("img", { name: "Current patient photo" })).toHaveAttribute(
      "src",
      expect.stringContaining("/uploads/patients/ama.jpg")
    );
    expect(screen.getByRole("button", { name: "Take new photo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Upload new photo" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Clear form" })).not.toBeInTheDocument();
  });

  it("defaults the OPD visit date to local today and places visit details before the photo section", () => {
    render(<PatientForm onSubmit={vi.fn()} enablePhoto variant="with-opd" />);

    const visitDate = screen.getByLabelText(/^Visit date/);
    expect(visitDate).toHaveValue(toLocalInputDate());
    expect(visitDate).toHaveAttribute("max", toLocalInputDate());
    expect(screen.getByLabelText(/^Remarks/)).toBeInTheDocument();
    expect(
      visitDate.compareDocumentPosition(screen.getByRole("heading", { name: "Patient photo (optional)" })) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it("offers a manual clinic-book number preview without visit fields", () => {
    render(<PatientForm onSubmit={vi.fn()} variant="clinic-record" />);

    const year = screen.getByLabelText(/Year/);
    const position = screen.getByLabelText(/Number in year/);
    expect(year).toHaveValue(new Date().getFullYear());
    expect(screen.queryByLabelText(/^Visit date/)).not.toBeInTheDocument();

    fireEvent.change(position, { target: { value: "45" } });
    expect(screen.getByText("PT-45/" + new Date().getFullYear())).toBeInTheDocument();
  });

  it("highlights both manual-number fields after a duplicate ID response", () => {
    render(
      <PatientForm
        onSubmit={vi.fn()}
        variant="clinic-record"
        manualNumberError="This patient number is already in use."
      />
    );

    expect(screen.getByLabelText(/Year/)).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText(/Number in year/)).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("This patient number is already in use.");
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
