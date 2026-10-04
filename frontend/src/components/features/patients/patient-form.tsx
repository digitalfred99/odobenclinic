"use client";

import { useEffect } from "react";
import { Controller, useForm, useWatch, type FieldErrors, type Resolver } from "react-hook-form";
import type { ZodIssue } from "zod";
import { patientFormSchema, type PatientFormValues } from "@/schemas/patient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { GhCardNumberInput, NhisNumberInput } from "@/components/ui/patient-identifier-inputs";
import { calculateAge } from "@/lib/dates";
import { sanitizePhoneNumber } from "@/lib/phone";

const EMPTY_FORM: PatientFormValues = {
  firstName: "",
  lastName: "",
  dateOfBirth: "",
  age: "",
  phone: "",
  ghCardNumber: "",
  nhisNumber: "",
  region: "",
  district: "",
  town: "",
  area: "",
  gender: "",
  maritalStatus: "",
};

export function PatientForm({
  initialValues,
  onSubmit,
  submitLabel = "Save patient",
  clearOnSuccess = false,
}: {
  initialValues?: Partial<PatientFormValues>;
  onSubmit: (values: PatientFormValues) => Promise<boolean | void> | boolean | void;
  submitLabel?: string;
  clearOnSuccess?: boolean;
}) {
  const form = useForm<PatientFormValues>({
    defaultValues: {
      ...EMPTY_FORM,
      ...initialValues,
      phone: sanitizePhoneNumber(initialValues?.phone ?? EMPTY_FORM.phone ?? ""),
    },
    resolver: (async (values) => {
      const result = patientFormSchema.safeParse(values);

      if (result.success) {
        return {
          values: result.data as PatientFormValues,
          errors: {} as FieldErrors<PatientFormValues>,
        } as unknown as ReturnType<Resolver<PatientFormValues>>;
      }

      const errors = result.error.issues.reduce<Record<string, { type: string; message: string }>>(
        (acc: Record<string, { type: string; message: string }>, issue: ZodIssue) => {
          const key = issue.path[0];
          if (typeof key === "string") {
            acc[key] = { type: issue.code, message: issue.message };
          }
          return acc;
        },
        {}
      );

      return {
        values: values as PatientFormValues,
        errors: errors as FieldErrors<PatientFormValues>,
      } as unknown as ReturnType<Resolver<PatientFormValues>>;
    }) as Resolver<PatientFormValues>,
  });

  const dateOfBirth = useWatch({ control: form.control, name: "dateOfBirth" });
  const ageValue = useWatch({ control: form.control, name: "age" });

  useEffect(() => {
    if (!dateOfBirth) {
      return;
    }

    const age = calculateAge(dateOfBirth);
    if (age !== null && !Number.isNaN(age)) {
      form.setValue("age", String(age), { shouldDirty: true });
    }
  }, [dateOfBirth, form]);

  const submit = async (values: PatientFormValues) => {
    const succeeded = await onSubmit({
      ...values,
      age: values.age === "" ? undefined : Number(values.age),
      dateOfBirth: values.dateOfBirth === "" ? undefined : values.dateOfBirth,
      gender: values.gender === "" ? undefined : values.gender,
      maritalStatus: values.maritalStatus === "" ? undefined : values.maritalStatus,
      phone: values.phone === "" ? undefined : values.phone,
      ghCardNumber: values.ghCardNumber === "" ? undefined : values.ghCardNumber,
      nhisNumber: values.nhisNumber === "" ? undefined : values.nhisNumber,
      region: values.region === "" ? undefined : values.region,
      district: values.district === "" ? undefined : values.district,
      town: values.town === "" ? undefined : values.town,
      area: values.area === "" ? undefined : values.area,
    });

    if (clearOnSuccess && succeeded !== false) {
      form.reset(EMPTY_FORM);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(submit)} className="space-y-6 rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="firstName" className="text-sm font-medium text-foreground">First name</label>
          <Input id="firstName" {...form.register("firstName")} />
          {form.formState.errors.firstName ? <p className="text-sm text-destructive">{form.formState.errors.firstName.message}</p> : null}
        </div>
        <div className="space-y-2">
          <label htmlFor="lastName" className="text-sm font-medium text-foreground">Last name</label>
          <Input id="lastName" {...form.register("lastName")} />
          {form.formState.errors.lastName ? <p className="text-sm text-destructive">{form.formState.errors.lastName.message}</p> : null}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="dateOfBirth" className="text-sm font-medium text-foreground">Date of birth</label>
          <Input id="dateOfBirth" type="date" {...form.register("dateOfBirth")} />
          {form.formState.errors.dateOfBirth ? <p className="text-sm text-destructive">{form.formState.errors.dateOfBirth.message}</p> : null}
        </div>
        <div className="space-y-2">
          <label htmlFor="age" className="text-sm font-medium text-foreground">Age</label>
          <Input id="age" type="number" min={0} max={130} placeholder="manual age" {...form.register("age")} />
          {typeof ageValue !== "undefined" && ageValue !== "" ? <p className="text-xs text-muted-foreground">Auto-calculated age: {ageValue}</p> : null}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="gender" className="text-sm font-medium text-foreground">Gender</label>
          <select id="gender" {...form.register("gender")} className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
            <option value="">Select</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </div>
        <div className="space-y-2">
          <label htmlFor="maritalStatus" className="text-sm font-medium text-foreground">Marital status</label>
          <select id="maritalStatus" {...form.register("maritalStatus")} className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
            <option value="">Select</option>
            <option value="single">Single</option>
            <option value="married">Married</option>
            <option value="divorced">Divorced</option>
            <option value="widowed">Widowed</option>
          </select>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Identification</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="ghCardNumber" className="text-sm font-medium text-foreground">Ghana Card number</label>
            <Controller
              control={form.control}
              name="ghCardNumber"
              render={({ field }) => (
                <GhCardNumberInput
                  id="ghCardNumber"
                  inputRef={field.ref}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={() => { field.onBlur(); void form.trigger("ghCardNumber"); }}
                  aria-invalid={Boolean(form.formState.errors.ghCardNumber)}
                  aria-describedby={form.formState.errors.ghCardNumber ? "ghCardNumber-error" : undefined}
                />
              )}
            />
            {form.formState.errors.ghCardNumber ? <p id="ghCardNumber-error" className="text-sm text-destructive">{form.formState.errors.ghCardNumber.message}</p> : null}
          </div>
          <div className="space-y-2">
            <label htmlFor="nhisNumber" className="text-sm font-medium text-foreground">NHIS number</label>
            <Controller
              control={form.control}
              name="nhisNumber"
              render={({ field }) => (
                <NhisNumberInput
                  id="nhisNumber"
                  inputRef={field.ref}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={() => { field.onBlur(); void form.trigger("nhisNumber"); }}
                  aria-invalid={Boolean(form.formState.errors.nhisNumber)}
                  aria-describedby={form.formState.errors.nhisNumber ? "nhisNumber-error" : undefined}
                />
              )}
            />
            {form.formState.errors.nhisNumber ? <p id="nhisNumber-error" className="text-sm text-destructive">{form.formState.errors.nhisNumber.message}</p> : null}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="phone" className="text-sm font-medium text-foreground">Phone</label>
          <PhoneInput id="phone" {...form.register("phone")} />
          {form.formState.errors.phone ? <p className="text-sm text-destructive">{form.formState.errors.phone.message}</p> : null}
        </div>
        <div className="space-y-2">
          <label htmlFor="region" className="text-sm font-medium text-foreground">Region</label>
          <Input id="region" {...form.register("region")} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <label htmlFor="district" className="text-sm font-medium text-foreground">District</label>
          <Input id="district" {...form.register("district")} />
        </div>
        <div className="space-y-2">
          <label htmlFor="town" className="text-sm font-medium text-foreground">Town</label>
          <Input id="town" {...form.register("town")} />
        </div>
        <div className="space-y-2">
          <label htmlFor="area" className="text-sm font-medium text-foreground">Area</label>
          <Input id="area" {...form.register("area")} />
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Saving..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}
