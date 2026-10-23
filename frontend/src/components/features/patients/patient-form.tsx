"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Controller, useForm, useWatch, type FieldErrors, type Resolver } from "react-hook-form";
import { Dialog } from "@base-ui/react/dialog";
import { Camera, ImagePlus, RefreshCw, RotateCcw, X } from "lucide-react";
import type { ZodIssue } from "zod";
import {
  clinicRecordPatientFormSchema,
  patientFormSchema,
  patientWithOpdFormSchema,
  type PatientFormValues,
} from "@/schemas/patient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { GhCardNumberInput, NhisNumberInput } from "@/components/ui/patient-identifier-inputs";
import { LocationCombobox } from "@/components/ui/location-combobox";
import { cn } from "@/lib/utils";
import { calculateAge, toLocalInputDate } from "@/lib/dates";
import { sanitizePhoneNumber } from "@/lib/phone";
import { usePatientLocationCache } from "@/lib/patient-location-cache";
import { preparePatientPhoto, resolvePatientPhotoUrl, validatePatientPhoto } from "@/lib/patient-photo";
import { PatientPhotoImage } from "@/components/features/patients/patient-photo-image";
import { PATIENT_RELIGIONS } from "@/types/patient";
import {
  GHANA_REGIONS,
  getAreaSuggestions,
  getDistrictSuggestions,
  getTownSuggestions,
} from "@/lib/ghana-locations";

const PatientPhotoCamera = dynamic(() => import("./patient-photo-camera"), { ssr: false });

function subscribeToCameraAvailability() {
  return () => {};
}

function getCameraAvailabilitySnapshot() {
  return Boolean(window.isSecureContext && navigator.mediaDevices?.getUserMedia);
}

function getServerCameraAvailabilitySnapshot() {
  return true;
}

const EMPTY_FORM: PatientFormValues = {
  firstName: "",
  otherName: "",
  lastName: "",
  email: "",
  postalAddress: "",
  occupation: "",
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
  religion: "",
  visitDate: "",
  visitRemarks: "",
  year: "",
  positionInYear: "",
};

const NEW_PATIENT_DEFAULTS: PatientFormValues = {
  ...EMPTY_FORM,
  region: "Central Region",
  district: "Asikuma-Odoben-Brakwa",
  town: "Odoben",
};

type PatientFormVariant = "with-opd" | "clinic-record" | "edit";

function getPatientFormDefaults(variant: PatientFormVariant): PatientFormValues {
  const today = toLocalInputDate();
  return {
    ...(variant === "edit" ? EMPTY_FORM : NEW_PATIENT_DEFAULTS),
    ...(variant === "with-opd" ? { visitDate: today } : {}),
    ...(variant === "clinic-record" ? { year: today.slice(0, 4) } : {}),
  };
}

function RequiredMark() {
  return <span aria-hidden="true" className="ml-1 text-destructive">*</span>;
}

export function PatientForm({
  initialValues,
  initialPhoto = null,
  existingPhotoUrl,
  onSubmit,
  onValuesChange,
  variant,
  submitLabel = "Save patient",
  clearOnSuccess = false,
  enablePhoto = false,
  photoError,
  manualNumberError,
  serverFieldErrors,
  onFieldChange,
  onManualNumberChange,
  onPhotoChange,
  className,
}: {
  initialValues?: Partial<PatientFormValues>;
  initialPhoto?: File | null;
  existingPhotoUrl?: string | null;
  onSubmit: (values: PatientFormValues, photo: File | null) => Promise<boolean | void> | boolean | void;
  onValuesChange?: (values: PatientFormValues) => void;
  variant?: PatientFormVariant;
  submitLabel?: string;
  clearOnSuccess?: boolean;
  enablePhoto?: boolean;
  photoError?: string | null;
  manualNumberError?: string | null;
  serverFieldErrors?: Partial<Record<keyof PatientFormValues, string>>;
  onFieldChange?: (field: keyof PatientFormValues, value: string) => void;
  onManualNumberChange?: () => void;
  onPhotoChange?: (photo?: File | null) => void;
  className?: string;
}) {
  const formVariant = variant ?? (initialValues ? "edit" : "with-opd");
  const localToday = toLocalInputDate();
  const [photo, setPhoto] = useState<File | null>(initialPhoto);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(() =>
    initialPhoto ? URL.createObjectURL(initialPhoto) : null
  );
  const [localPhotoError, setLocalPhotoError] = useState<string | null>(null);
  const [isPreparingPhoto, setIsPreparingPhoto] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [clearConfirmationOpen, setClearConfirmationOpen] = useState(false);
  const { locations: savedLocations, status: locationSyncStatus } = usePatientLocationCache();
  const cameraAvailable = useSyncExternalStore(
    subscribeToCameraAvailability,
    getCameraAvailabilitySnapshot,
    getServerCameraAvailabilitySnapshot
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadRequestRef = useRef(0);

  const form = useForm<PatientFormValues>({
    defaultValues: {
      ...getPatientFormDefaults(formVariant),
      ...initialValues,
      phone: sanitizePhoneNumber(initialValues?.phone ?? EMPTY_FORM.phone ?? ""),
    },
    resolver: (async (values) => {
      const schema = formVariant === "with-opd"
        ? patientWithOpdFormSchema
        : formVariant === "clinic-record"
          ? clinicRecordPatientFormSchema
          : patientFormSchema;
      const result = schema.safeParse(values);

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
    mode: "onSubmit",
    reValidateMode: "onChange",
  });

  const dateOfBirth = useWatch({ control: form.control, name: "dateOfBirth" });
  const formValues = useWatch({ control: form.control });
  const ageValue = useWatch({ control: form.control, name: "age" });
  const yearValue = useWatch({ control: form.control, name: "year" });
  const positionInYearValue = useWatch({ control: form.control, name: "positionInYear" });
  const regionValue = useWatch({ control: form.control, name: "region" });
  const districtValue = useWatch({ control: form.control, name: "district" });
  const townValue = useWatch({ control: form.control, name: "town" });
  useEffect(() => {
    if (!onValuesChange) return;
    onValuesChange(formValues as PatientFormValues);
  }, [formValues, onValuesChange]);

  const districtSuggestions = getDistrictSuggestions(savedLocations, regionValue ?? "");
  const townSuggestions = getTownSuggestions(savedLocations, regionValue ?? "", districtValue ?? "");
  const areaSuggestions = getAreaSuggestions(savedLocations, regionValue ?? "", districtValue ?? "", townValue ?? "");
  const previewYear = String(yearValue ?? "").trim();
  const previewPosition = String(positionInYearValue ?? "").trim();
  const patientIdPreview = /^\d{4}$/.test(previewYear) && /^\d{1,6}$/.test(previewPosition)
    ? `PT-${Number(previewPosition)}/${previewYear}`
    : null;

  useEffect(() => () => {
    if (photoPreviewUrl) {
      URL.revokeObjectURL(photoPreviewUrl);
    }
  }, [photoPreviewUrl]);

  useEffect(() => {
    if (!dateOfBirth) {
      return;
    }

    const age = calculateAge(dateOfBirth);
    if (age !== null && !Number.isNaN(age)) {
      form.setValue("age", String(age), { shouldDirty: true });
    }
  }, [dateOfBirth, form]);

  const selectPhoto = useCallback((nextPhoto: File | null) => {
    setPhoto(nextPhoto);
    setPhotoPreviewUrl(nextPhoto ? URL.createObjectURL(nextPhoto) : null);
    setLocalPhotoError(null);
    setIsPreparingPhoto(false);
    onPhotoChange?.(nextPhoto);
  }, [onPhotoChange]);

  const openFilePicker = useCallback(() => fileInputRef.current?.click(), []);
  const closeCamera = useCallback(() => setCameraOpen(false), [setCameraOpen]);
  const useCapturedPhoto = useCallback((capturedPhoto: File) => {
    uploadRequestRef.current += 1;
    selectPhoto(capturedPhoto);
    setCameraOpen(false);
  }, [selectPhoto, setCameraOpen]);
  const removePhoto = useCallback(() => {
    uploadRequestRef.current += 1;
    selectPhoto(null);
  }, [selectPhoto]);

  const clearForm = () => {
    const defaults = getPatientFormDefaults(formVariant);
    form.reset(defaults);
    onValuesChange?.(defaults);
    selectPhoto(null);
    setLocalPhotoError(null);
    setClearConfirmationOpen(false);
  };

  const handleUpload = async (file: File | undefined) => {
    if (!file) {
      return;
    }

    setLocalPhotoError(null);
    onPhotoChange?.();
    const validationError = validatePatientPhoto(file);
    if (validationError) {
      setLocalPhotoError(validationError);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    const requestId = ++uploadRequestRef.current;
    setIsPreparingPhoto(true);
    try {
      const preparedPhoto = await preparePatientPhoto(file);
      if (requestId === uploadRequestRef.current) {
        selectPhoto(preparedPhoto);
      }
    } catch (error) {
      if (requestId === uploadRequestRef.current) {
        setLocalPhotoError(error instanceof Error ? error.message : "Unable to process this photo.");
      }
    } finally {
      if (requestId === uploadRequestRef.current) {
        setIsPreparingPhoto(false);
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const submit = async (values: PatientFormValues) => {
    const succeeded = await onSubmit({
      ...values,
      otherName: values.otherName?.trim() || undefined,
      email: values.email?.trim() || undefined,
      postalAddress: values.postalAddress || undefined,
      occupation: values.occupation || undefined,
      age: values.age === "" ? undefined : Number(values.age),
      dateOfBirth: values.dateOfBirth === "" ? undefined : values.dateOfBirth,
      gender: values.gender === "" ? undefined : values.gender,
      maritalStatus: values.maritalStatus === "" ? undefined : values.maritalStatus,
      religion: values.religion === "" ? undefined : values.religion,
      phone: values.phone === "" ? undefined : values.phone,
      ghCardNumber: values.ghCardNumber === "" ? undefined : values.ghCardNumber,
      nhisNumber: values.nhisNumber === "" ? undefined : values.nhisNumber,
      region: values.region === "" ? undefined : values.region,
      district: values.district === "" ? undefined : values.district,
      town: values.town === "" ? undefined : values.town,
      area: values.area === "" ? undefined : values.area,
      visitDate: values.visitDate === "" ? undefined : values.visitDate,
      visitRemarks: values.visitRemarks?.trim() || undefined,
      year: values.year === "" || values.year === undefined ? undefined : Number(values.year),
      positionInYear: values.positionInYear === "" || values.positionInYear === undefined
        ? undefined
        : Number(values.positionInYear),
    }, photo);

    if (clearOnSuccess && succeeded !== false) {
      form.reset(getPatientFormDefaults(formVariant));
      selectPhoto(null);
    }
  };

  return (
    <form
      onSubmit={form.handleSubmit(submit)}
      onChangeCapture={(event) => {
        const target = event.target;
        if (
          !(target instanceof HTMLInputElement)
          && !(target instanceof HTMLSelectElement)
          && !(target instanceof HTMLTextAreaElement)
        ) {
          return;
        }
        if (!Object.prototype.hasOwnProperty.call(EMPTY_FORM, target.name)) {
          return;
        }
        onFieldChange?.(target.name as keyof PatientFormValues, target.value);
      }}
      className={cn("space-y-7 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6", className)}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-foreground">Personal details</h3>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Required fields are marked with an asterisk. Date of birth or age is required.
          </p>
        </div>
        {enablePhoto && formVariant !== "edit" ? (
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={form.formState.isSubmitting || isPreparingPhoto}
            onClick={() => setClearConfirmationOpen(true)}
          >
            <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
            Clear form
          </Button>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <label htmlFor="firstName" className="text-sm font-medium text-foreground">First name<RequiredMark /></label>
          <Input id="firstName" aria-invalid={Boolean(form.formState.errors.firstName || serverFieldErrors?.firstName)} {...form.register("firstName")} />
          {form.formState.errors.firstName ? <p className="text-sm text-destructive">{form.formState.errors.firstName.message}</p> : null}
          {serverFieldErrors?.firstName ? <p className="text-sm text-destructive">{serverFieldErrors.firstName}</p> : null}
        </div>
        <div className="space-y-2">
          <label htmlFor="otherName" className="text-sm font-medium text-foreground">Other name</label>
          <Input id="otherName" {...form.register("otherName")} />
        </div>
        <div className="space-y-2">
          <label htmlFor="lastName" className="text-sm font-medium text-foreground">Last name<RequiredMark /></label>
          <Input id="lastName" aria-invalid={Boolean(form.formState.errors.lastName || serverFieldErrors?.lastName)} {...form.register("lastName")} />
          {form.formState.errors.lastName ? <p className="text-sm text-destructive">{form.formState.errors.lastName.message}</p> : null}
          {serverFieldErrors?.lastName ? <p className="text-sm text-destructive">{serverFieldErrors.lastName}</p> : null}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <label htmlFor="dateOfBirth" className="text-sm font-medium text-foreground">Date of birth<RequiredMark /></label>
          <Input
            id="dateOfBirth"
            type="date"
            aria-invalid={Boolean(form.formState.errors.dateOfBirth || serverFieldErrors?.dateOfBirth)}
            {...form.register("dateOfBirth", {
              onChange: (event) => {
                if (!event.currentTarget.value && dateOfBirth) {
                  form.setValue("age", "");
                }
              },
            })}
          />
          {form.formState.errors.dateOfBirth ? <p className="text-sm text-destructive">{form.formState.errors.dateOfBirth.message}</p> : null}
          {serverFieldErrors?.dateOfBirth ? <p className="text-sm text-destructive">{serverFieldErrors.dateOfBirth}</p> : null}
          <p className="text-xs text-muted-foreground">Date of birth or age is required.</p>
        </div>
        <div className="space-y-2">
          <label htmlFor="age" className="text-sm font-medium text-foreground">Age<RequiredMark /></label>
          <Input
            id="age"
            type="number"
            min={0}
            max={130}
            step={1}
            placeholder="manual age"
            aria-invalid={Boolean(form.formState.errors.age || serverFieldErrors?.age)}
            {...form.register("age")}
          />
          {typeof ageValue !== "undefined" && ageValue !== "" ? (
            <p className="text-xs text-muted-foreground">
              {dateOfBirth ? `Auto-calculated age: ${ageValue}` : "Manually entered"}
            </p>
          ) : <p className="text-xs text-muted-foreground">Enter a date of birth or an age.</p>}
          {serverFieldErrors?.age ? <p className="text-sm text-destructive">{serverFieldErrors.age}</p> : null}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <label htmlFor="gender" className="text-sm font-medium text-foreground">Gender<RequiredMark /></label>
          <select
            id="gender"
            aria-required="true"
            aria-invalid={Boolean(form.formState.errors.gender || serverFieldErrors?.gender)}
            aria-describedby={form.formState.errors.gender || serverFieldErrors?.gender ? "gender-error" : undefined}
            {...form.register("gender")}
            className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Select</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
          {form.formState.errors.gender ? <p id="gender-error" className="text-sm text-destructive">{form.formState.errors.gender.message}</p> : null}
          {serverFieldErrors?.gender ? <p className="text-sm text-destructive">{serverFieldErrors.gender}</p> : null}
        </div>
        <div className="space-y-2">
          <label htmlFor="maritalStatus" className="text-sm font-medium text-foreground">Marital status<RequiredMark /></label>
          <select
            id="maritalStatus"
            aria-required="true"
            aria-invalid={Boolean(form.formState.errors.maritalStatus || serverFieldErrors?.maritalStatus)}
            aria-describedby={form.formState.errors.maritalStatus || serverFieldErrors?.maritalStatus ? "maritalStatus-error" : undefined}
            {...form.register("maritalStatus")}
            className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Select</option>
            <option value="single">Single</option>
            <option value="married">Married</option>
            <option value="divorced">Divorced</option>
            <option value="widowed">Widowed</option>
          </select>
          {form.formState.errors.maritalStatus ? (
            <p id="maritalStatus-error" className="text-sm text-destructive">{form.formState.errors.maritalStatus.message}</p>
          ) : null}
          {serverFieldErrors?.maritalStatus ? <p className="text-sm text-destructive">{serverFieldErrors.maritalStatus}</p> : null}
        </div>
        <div className="space-y-2">
          <label htmlFor="religion" className="text-sm font-medium text-foreground">Religion<RequiredMark /></label>
          <select
            id="religion"
            aria-required="true"
            aria-invalid={Boolean(form.formState.errors.religion || serverFieldErrors?.religion)}
            aria-describedby={form.formState.errors.religion ? "religion-error" : undefined}
            {...form.register("religion")}
            className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Select religion</option>
            {PATIENT_RELIGIONS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
          </select>
          {form.formState.errors.religion ? <p id="religion-error" className="text-sm text-destructive">{form.formState.errors.religion.message}</p> : null}
          {serverFieldErrors?.religion ? <p className="text-sm text-destructive">{serverFieldErrors.religion}</p> : null}
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="occupation" className="text-sm font-medium text-foreground">Occupation</label>
        <Input
          id="occupation"
          maxLength={100}
          aria-invalid={Boolean(form.formState.errors.occupation || serverFieldErrors?.occupation)}
          {...form.register("occupation")}
        />
        {form.formState.errors.occupation ? <p className="text-sm text-destructive">{form.formState.errors.occupation.message}</p> : null}
        {serverFieldErrors?.occupation ? <p className="text-sm text-destructive">{serverFieldErrors.occupation}</p> : null}
      </div>

      <section className="space-y-4 border-t border-border pt-5" aria-labelledby="patient-identification-heading">
        <div>
          <h3 id="patient-identification-heading" className="text-base font-semibold text-foreground">Identification</h3>
          <p className="mt-1 text-sm text-muted-foreground">Optional national and health-insurance identifiers.</p>
        </div>
        <div className="space-y-3">
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
              {serverFieldErrors?.ghCardNumber ? <p className="text-sm text-destructive">{serverFieldErrors.ghCardNumber}</p> : null}
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
              {serverFieldErrors?.nhisNumber ? <p className="text-sm text-destructive">{serverFieldErrors.nhisNumber}</p> : null}
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4 border-t border-border pt-5" aria-labelledby="patient-contact-heading">
        <div>
          <h3 id="patient-contact-heading" className="text-base font-semibold text-foreground">Contact &amp; location</h3>
          <p className="mt-1 text-sm text-muted-foreground">Add the best available contact number and area details.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="phone" className="text-sm font-medium text-foreground">Phone</label>
            <PhoneInput
              id="phone"
              aria-invalid={Boolean(form.formState.errors.phone || serverFieldErrors?.phone)}
              error={form.formState.errors.phone?.message ?? serverFieldErrors?.phone}
              {...form.register("phone")}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium text-foreground">Email</label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              maxLength={100}
              aria-invalid={Boolean(form.formState.errors.email || serverFieldErrors?.email)}
              {...form.register("email")}
            />
            {form.formState.errors.email ? <p className="text-sm text-destructive">{form.formState.errors.email.message}</p> : null}
            {serverFieldErrors?.email ? <p className="text-sm text-destructive">{serverFieldErrors.email}</p> : null}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <label htmlFor="region" className="text-sm font-medium text-foreground">Region</label>
            <select
              id="region"
              {...form.register("region", {
                onChange: () => {
                  form.setValue("district", "");
                  form.setValue("town", "");
                  form.setValue("area", "");
                },
              })}
              className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Select region</option>
              {GHANA_REGIONS.map((region) => <option key={region} value={region}>{region}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label htmlFor="district" className="text-sm font-medium text-foreground">District</label>
            <Controller
              control={form.control}
              name="district"
              render={({ field }) => (
                <LocationCombobox
                  id="district"
                  value={field.value ?? ""}
                  options={districtSuggestions}
                  placeholder="Type or choose a district"
                  suggestionsLabel="Show district suggestions"
                  inputRef={field.ref}
                  onBlur={field.onBlur}
                  onChange={(value) => {
                    field.onChange(value);
                    form.setValue("town", "");
                    form.setValue("area", "");
                  }}
                />
              )}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="town" className="text-sm font-medium text-foreground">Town</label>
            <Controller
              control={form.control}
              name="town"
              render={({ field }) => (
                <LocationCombobox
                  id="town"
                  value={field.value ?? ""}
                  options={townSuggestions}
                  placeholder="Type or choose a town"
                  suggestionsLabel="Show town suggestions"
                  inputRef={field.ref}
                  onBlur={field.onBlur}
                  onChange={(value) => {
                    field.onChange(value);
                    form.setValue("area", "");
                  }}
                />
              )}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="area" className="text-sm font-medium text-foreground">Area</label>
            <Controller
              control={form.control}
              name="area"
              render={({ field }) => (
                <LocationCombobox
                  id="area"
                  value={field.value ?? ""}
                  options={areaSuggestions}
                  placeholder="Type or choose an area"
                  suggestionsLabel="Show area suggestions"
                  inputRef={field.ref}
                  onBlur={field.onBlur}
                  onChange={field.onChange}
                />
              )}
            />
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="postalAddress" className="text-sm font-medium text-foreground">Postal address</label>
          <Input
            id="postalAddress"
            maxLength={100}
            aria-invalid={Boolean(form.formState.errors.postalAddress || serverFieldErrors?.postalAddress)}
            {...form.register("postalAddress")}
          />
          {form.formState.errors.postalAddress ? <p className="text-sm text-destructive">{form.formState.errors.postalAddress.message}</p> : null}
          {serverFieldErrors?.postalAddress ? <p className="text-sm text-destructive">{serverFieldErrors.postalAddress}</p> : null}
        </div>
      </section>

      {locationSyncStatus === "loading" ? (
        <p className="text-xs text-muted-foreground" role="status">Refreshing saved location suggestions…</p>
      ) : locationSyncStatus === "error" ? (
        <p className="text-xs text-destructive" role="status">
          Saved locations could not be refreshed. You can still type a new location.
        </p>
      ) : null}

      {formVariant === "clinic-record" ? (
        <section className="space-y-4 border-t border-border pt-5" aria-labelledby="manual-patient-number-heading">
          <div>
            <h3 id="manual-patient-number-heading" className="text-base font-semibold text-foreground">Paper-book patient number</h3>
            <p className="mt-1 text-sm text-muted-foreground">Enter the year and number shown in the clinic record.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="year" className="text-sm font-medium text-foreground">Year<RequiredMark /></label>
              <Input
                id="year"
                type="number"
                min={2000}
                max={localToday.slice(0, 4)}
                step={1}
                inputMode="numeric"
                aria-required="true"
                aria-invalid={Boolean(manualNumberError || form.formState.errors.year || serverFieldErrors?.year)}
                aria-describedby={manualNumberError ? "manual-patient-number-error" : form.formState.errors.year ? "year-error" : undefined}
                className={manualNumberError ? "border-destructive" : undefined}
                {...form.register("year", { onChange: onManualNumberChange })}
              />
              {form.formState.errors.year ? <p id="year-error" className="text-sm text-destructive">{form.formState.errors.year.message}</p> : null}
              {serverFieldErrors?.year ? <p className="text-sm text-destructive">{serverFieldErrors.year}</p> : null}
            </div>
            <div className="space-y-2">
              <label htmlFor="positionInYear" className="text-sm font-medium text-foreground">Number in year<RequiredMark /></label>
              <Input
                id="positionInYear"
                type="number"
                min={1}
                max={999999}
                step={1}
                inputMode="numeric"
                aria-required="true"
                aria-invalid={Boolean(manualNumberError || form.formState.errors.positionInYear || serverFieldErrors?.positionInYear)}
                aria-describedby={manualNumberError ? "manual-patient-number-error" : form.formState.errors.positionInYear ? "positionInYear-error" : undefined}
                className={manualNumberError ? "border-destructive" : undefined}
                {...form.register("positionInYear", { onChange: onManualNumberChange })}
              />
              {form.formState.errors.positionInYear ? <p id="positionInYear-error" className="text-sm text-destructive">{form.formState.errors.positionInYear.message}</p> : null}
              {serverFieldErrors?.positionInYear ? <p className="text-sm text-destructive">{serverFieldErrors.positionInYear}</p> : null}
            </div>
          </div>
          {manualNumberError ? <p id="manual-patient-number-error" className="text-sm text-destructive" role="alert">{manualNumberError}</p> : null}
          <p className="rounded-lg bg-muted px-3 py-2 text-sm text-foreground" aria-live="polite">
            Patient ID preview: <span className="font-mono font-semibold">{patientIdPreview ?? "Enter year and number in year"}</span>
          </p>
        </section>
      ) : null}

      {formVariant === "with-opd" ? (
        <section className="space-y-4 border-t border-border pt-5" aria-labelledby="visit-details-heading">
          <div>
            <h3 id="visit-details-heading" className="text-base font-semibold text-foreground">Visit details</h3>
            <p className="mt-1 text-sm text-muted-foreground">Record the date and any notes for the patient’s first OPD visit.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="visitDate" className="text-sm font-medium text-foreground">Visit date<RequiredMark /></label>
              <Input
                id="visitDate"
                type="date"
                max={localToday}
                aria-required="true"
                aria-invalid={Boolean(form.formState.errors.visitDate || serverFieldErrors?.visitDate)}
                aria-describedby={[
                  form.formState.errors.visitDate ? "visitDate-error" : "",
                  serverFieldErrors?.visitDate ? "visitDate-server-error" : "",
                ].filter(Boolean).join(" ") || undefined}
                {...form.register("visitDate")}
              />
              {form.formState.errors.visitDate ? <p id="visitDate-error" className="text-sm text-destructive">{form.formState.errors.visitDate.message}</p> : null}
              {serverFieldErrors?.visitDate ? <p id="visitDate-server-error" className="text-sm text-destructive">{serverFieldErrors.visitDate}</p> : null}
            </div>
            <div className="space-y-2">
              <label htmlFor="visitRemarks" className="text-sm font-medium text-foreground">Remarks <span className="font-normal text-muted-foreground">(optional)</span></label>
              <textarea
                id="visitRemarks"
                rows={3}
                {...form.register("visitRemarks")}
                aria-invalid={Boolean(serverFieldErrors?.visitRemarks)}
                aria-describedby={serverFieldErrors?.visitRemarks ? "visitRemarks-error" : undefined}
                className="flex min-h-20 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
              {serverFieldErrors?.visitRemarks ? <p id="visitRemarks-error" className="text-sm text-destructive">{serverFieldErrors.visitRemarks}</p> : null}
            </div>
          </div>
        </section>
      ) : null}

      {enablePhoto ? (
        <section className="space-y-3 rounded-xl border border-border p-4" aria-labelledby="patient-photo-heading">
          <div>
            <h3 id="patient-photo-heading" className="text-sm font-semibold text-foreground">Patient photo <span className="font-normal text-muted-foreground">(optional)</span></h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {formVariant === "edit" && existingPhotoUrl
                ? "Take or upload a new photo to replace the current one. Leave it unchanged to keep the current photo."
                : "Take a photo or upload a JPEG, PNG, or WebP image (up to 5 MB)."}
            </p>
          </div>
          {photo ? (
            <div className="flex flex-wrap items-center gap-4">
              {photoPreviewUrl ? (
                <PatientPhotoImage src={photoPreviewUrl} alt="Selected patient photo" width={224} height={168} className="aspect-[4/3] w-28 rounded-lg border border-border object-cover" />
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" className="min-h-11" disabled={!cameraAvailable} onClick={() => setCameraOpen(true)}>
                  <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />Retake
                </Button>
                <Button type="button" variant="outline" className="min-h-11" onClick={removePhoto}>
                  <X className="mr-2 h-4 w-4" aria-hidden="true" />
                  {formVariant === "edit" && existingPhotoUrl ? "Undo replacement" : "Remove"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-4">
              {existingPhotoUrl ? (
                <PatientPhotoImage
                  src={resolvePatientPhotoUrl(existingPhotoUrl)}
                  alt="Current patient photo"
                  width={224}
                  height={168}
                  className="aspect-[4/3] w-28 rounded-lg border border-border object-cover"
                />
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="min-h-11"
                  disabled={!cameraAvailable}
                  onClick={() => setCameraOpen(true)}
                >
                  <Camera className="mr-2 h-4 w-4" aria-hidden="true" />{existingPhotoUrl ? "Take new photo" : "Take photo"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11"
                  disabled={isPreparingPhoto}
                  onClick={openFilePicker}
                >
                  <ImagePlus className="mr-2 h-4 w-4" aria-hidden="true" />
                  {isPreparingPhoto ? "Preparing photo…" : existingPhotoUrl ? "Upload new photo" : "Upload photo"}
                </Button>
                <input
                  ref={fileInputRef}
                  id="patient-photo-upload"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  aria-label="Upload patient photo"
                  onChange={(event) => { void handleUpload(event.currentTarget.files?.[0]); }}
                />
              </div>
            </div>
          )}
          {!cameraAvailable ? (
            <p className="text-sm text-muted-foreground">Camera needs a secure (HTTPS) connection. You can upload a photo instead.</p>
          ) : null}
          {isPreparingPhoto ? <p className="text-sm text-muted-foreground" role="status">Preparing photo…</p> : null}
          {localPhotoError || photoError ? (
            <p className="text-sm text-destructive" role="alert">{localPhotoError ?? photoError}</p>
          ) : null}
        </section>
      ) : null}

      <div className="flex justify-end border-t border-border pt-5">
        <Button type="submit" className="min-h-11 w-full sm:w-auto" disabled={form.formState.isSubmitting || isPreparingPhoto}>
          {form.formState.isSubmitting ? "Saving..." : submitLabel}
        </Button>
      </div>
      {cameraOpen ? (
        <PatientPhotoCamera
          onClose={closeCamera}
          onUsePhoto={useCapturedPhoto}
        />
      ) : null}
      <Dialog.Root open={clearConfirmationOpen} modal onOpenChange={setClearConfirmationOpen}>
        <Dialog.Portal>
          <Dialog.Backdrop forceRender className="pointer-events-auto touch-none fixed inset-0 z-[110] bg-foreground/50 backdrop-blur-sm" />
          <Dialog.Popup className="fixed left-1/2 top-1/2 z-[111] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card p-6 text-card-foreground shadow-xl outline-none">
            <Dialog.Title className="text-lg font-semibold text-foreground">Clear registration form?</Dialog.Title>
            <Dialog.Description className="mt-2 text-sm leading-6 text-muted-foreground">
              This clears all entered patient and visit details and removes the selected photo. You can’t undo this.
            </Dialog.Description>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" onClick={() => setClearConfirmationOpen(false)}>
                Keep details
              </Button>
              <Button type="button" variant="destructive" onClick={clearForm}>
                Clear all
              </Button>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </form>
  );
}
