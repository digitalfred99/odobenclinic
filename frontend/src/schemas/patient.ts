import { z } from "zod";
import { getPhoneNumberError } from "@/lib/phone";
import { getDateOfBirthError, getOpdVisitDateError, toLocalInputDate } from "@/lib/dates";
import { PATIENT_RELIGION_VALUES } from "@/types/patient";

export type PatientFormValues = {
  firstName: string;
  otherName?: string;
  lastName: string;
  email?: string;
  postalAddress?: string;
  occupation?: string;
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
  religion?: typeof PATIENT_RELIGION_VALUES[number] | "";
  visitDate?: string;
  visitRemarks?: string;
  year?: number | string;
  positionInYear?: number | string;
};

const patientFieldsSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required"),
  otherName: z.string().trim().optional().or(z.literal("")),
  lastName: z.string().trim().min(1, "Last name is required"),
  email: z.string().trim().max(100, "Email must be 100 characters or fewer")
    .email("Enter a valid email address.").optional().or(z.literal("")),
  postalAddress: z.string().max(100, "Postal address must be 100 characters or fewer").optional().or(z.literal("")),
  occupation: z.string().max(100, "Occupation must be 100 characters or fewer").optional().or(z.literal("")),
  dateOfBirth: z.string().optional().or(z.literal("")),
  age: z.union([
    z.number().int().min(0, "Age must be at least 0").max(130, "Age must be 130 or less"),
    z.literal(""),
    z.string().trim().regex(/^\d+$/, "Age must be a whole number").transform(Number)
      .pipe(z.number().int().min(0, "Age must be at least 0").max(130, "Age must be 130 or less")),
  ]).optional(),
  phone: z.string().trim().superRefine((phone, context) => {
    const error = getPhoneNumberError(phone);
    if (error) {
      context.addIssue({ code: "custom", message: error });
    }
  }).optional().or(z.literal("")),
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
  gender: z.enum(["male", "female"]).optional().or(z.literal(""))
    .refine((gender) => gender !== "" && gender !== undefined, "Gender is required"),
  maritalStatus: z.enum(["single", "married", "divorced", "widowed"], {
    error: "Marital status is required",
  }),
  religion: z.enum(PATIENT_RELIGION_VALUES, {
    error: "Religion is required",
  }),
});

function refinePatientFields(
  values: z.infer<typeof patientFieldsSchema>,
  context: z.RefinementCtx
) {
  const hasDob = Boolean(values.dateOfBirth && values.dateOfBirth.length > 0);
  const hasAge = values.age !== undefined && values.age !== null && values.age !== "";

  if (!hasDob && !hasAge) {
    context.addIssue({
      code: "custom",
      message: "Provide either a date of birth or an age.",
      path: ["dateOfBirth"],
    });
  }

  if (hasDob) {
    const dateError = getDateOfBirthError(values.dateOfBirth ?? "");
    if (dateError) {
      context.addIssue({
        code: "custom",
        message: dateError,
        path: ["dateOfBirth"],
      });
    }
  }
}

export const patientFormSchema = patientFieldsSchema.superRefine(refinePatientFields);

export const patientWithOpdFormSchema = patientFieldsSchema.extend({
  visitDate: z.string(),
  visitRemarks: z.string().optional().or(z.literal("")),
}).superRefine((values, context) => {
  refinePatientFields(values, context);
  const dateError = getOpdVisitDateError(values.visitDate);
  if (dateError) {
    context.addIssue({ code: "custom", message: dateError, path: ["visitDate"] });
  }
});

const integerInputSchema = z.union([
  z.number().int(),
  z.literal(""),
  z.string().trim().regex(/^\d+$/, "Enter a whole number").transform(Number),
]).optional();

export const clinicRecordPatientFormSchema = patientFieldsSchema.extend({
  year: integerInputSchema,
  positionInYear: integerInputSchema,
}).superRefine((values, context) => {
  refinePatientFields(values, context);

  const currentYear = Number(toLocalInputDate().slice(0, 4));
  if (values.year === undefined || values.year === "") {
    context.addIssue({ code: "custom", message: "Year is required.", path: ["year"] });
  } else if (values.year < 2000 || values.year > currentYear) {
    context.addIssue({
      code: "custom",
      message: `Year must be between 2000 and ${currentYear}.`,
      path: ["year"],
    });
  }

  if (values.positionInYear === undefined || values.positionInYear === "") {
    context.addIssue({ code: "custom", message: "Number in year is required.", path: ["positionInYear"] });
  } else if (values.positionInYear < 1 || values.positionInYear > 999999) {
    context.addIssue({
      code: "custom",
      message: "Number in year must be between 1 and 999999.",
      path: ["positionInYear"],
    });
  }
});
