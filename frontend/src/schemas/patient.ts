import { z } from "zod";
import { isTenDigitPhoneNumber } from "@/lib/phone";
import { getDateOfBirthError } from "@/lib/dates";

export type PatientFormValues = {
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  age?: number | string;
  phone?: string;
  ghCardNumber?: string;
  nhisNumber?: string;
  region?: string;
  district?: string;
  town?: string;
  area?: string;
  gender?: "male" | "female" | "";
  maritalStatus?: "single" | "married" | "divorced" | "widowed" | "";
};

export const patientFormSchema = z
  .object({
    firstName: z.string().trim().min(1, "First name is required"),
    lastName: z.string().trim().min(1, "Last name is required"),
    dateOfBirth: z.string().optional().or(z.literal("")),
    age: z.union([
      z.coerce.number().min(0, "Age must be at least 0").max(130, "Age must be 130 or less"),
      z.literal(""),
      z.string().trim(),
    ]).optional(),
    phone: z.string().trim().refine((phone) => phone === "" || isTenDigitPhoneNumber(phone), "Phone number must be exactly 10 digits").optional().or(z.literal("")),
    ghCardNumber: z.string().optional().or(z.literal("")).refine(
      (value) => !value || /^GHA-\d{9}-\d$/.test(value),
      "Enter a valid Ghana Card number in the format GHA-XXXXXXXXX-X."
    ),
    nhisNumber: z.string().optional().or(z.literal("")).refine(
      (value) => !value || /^\d{8}$/.test(value),
      "NHIS number must be exactly 8 digits."
    ),
    region: z.string().trim().optional().or(z.literal("")),
    district: z.string().trim().optional().or(z.literal("")),
    town: z.string().trim().optional().or(z.literal("")),
    area: z.string().trim().optional().or(z.literal("")),
    gender: z.enum(["male", "female"]).optional().or(z.literal("")),
    maritalStatus: z.enum(["single", "married", "divorced", "widowed"]).optional().or(z.literal("")),
  })
  .superRefine((values, ctx) => {
    const hasDob = Boolean(values.dateOfBirth && values.dateOfBirth.length > 0);
    const hasAge = values.age !== undefined && values.age !== null && values.age !== "";

    if (!hasDob && !hasAge) {
      ctx.addIssue({
        code: "custom",
        message: "Provide either a date of birth or an age.",
        path: ["dateOfBirth"],
      });
    }

    if (hasDob) {
      const dateError = getDateOfBirthError(values.dateOfBirth ?? "");
      if (dateError) {
        ctx.addIssue({
          code: "custom",
          message: dateError,
          path: ["dateOfBirth"],
        });
      }
    }
  });
