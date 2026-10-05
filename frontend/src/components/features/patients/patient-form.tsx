"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Controller, useForm, useWatch, type FieldErrors, type Resolver } from "react-hook-form";
import { Camera, ImagePlus, RefreshCw, X } from "lucide-react";
import type { ZodIssue } from "zod";
import { patientFormSchema, type PatientFormValues } from "@/schemas/patient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { GhCardNumberInput, NhisNumberInput } from "@/components/ui/patient-identifier-inputs";
import { calculateAge } from "@/lib/dates";
import { sanitizePhoneNumber } from "@/lib/phone";
import { preparePatientPhoto, validatePatientPhoto } from "@/lib/patient-photo";

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
  enablePhoto = false,
  photoError,
  onPhotoChange,
}: {
  initialValues?: Partial<PatientFormValues>;
  onSubmit: (values: PatientFormValues, photo: File | null) => Promise<boolean | void> | boolean | void;
  submitLabel?: string;
  clearOnSuccess?: boolean;
  enablePhoto?: boolean;
  photoError?: string | null;
  onPhotoChange?: () => void;
}) {
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [localPhotoError, setLocalPhotoError] = useState<string | null>(null);
  const [isPreparingPhoto, setIsPreparingPhoto] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const cameraAvailable = useSyncExternalStore(
    subscribeToCameraAvailability,
    getCameraAvailabilitySnapshot,
    getServerCameraAvailabilitySnapshot
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadRequestRef = useRef(0);

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
    onPhotoChange?.();
  }, [onPhotoChange]);

  const openFilePicker = useCallback(() => fileInputRef.current?.click(), []);
  const closeCamera = useCallback(() => setCameraOpen(false), []);
  const useCapturedPhoto = useCallback((capturedPhoto: File) => {
    uploadRequestRef.current += 1;
    selectPhoto(capturedPhoto);
    setCameraOpen(false);
  }, [selectPhoto]);
  const removePhoto = useCallback(() => {
    uploadRequestRef.current += 1;
    selectPhoto(null);
  }, [selectPhoto]);

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
    }, photo);

    if (clearOnSuccess && succeeded !== false) {
      form.reset(EMPTY_FORM);
      selectPhoto(null);
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

      {enablePhoto ? (
        <section className="space-y-3 rounded-xl border border-border p-4" aria-labelledby="patient-photo-heading">
          <div>
            <h3 id="patient-photo-heading" className="text-sm font-semibold text-foreground">Patient photo <span className="font-normal text-muted-foreground">(optional)</span></h3>
            <p className="mt-1 text-sm text-muted-foreground">Take a photo or upload a JPEG, PNG, or WebP image (up to 5 MB).</p>
          </div>
          {photo ? (
            <div className="flex flex-wrap items-center gap-4">
              {photoPreviewUrl ? (
                <Image src={photoPreviewUrl} alt="Selected patient photo" width={224} height={168} unoptimized className="aspect-[4/3] w-28 rounded-lg border border-border object-cover" />
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" className="min-h-11" disabled={!cameraAvailable} onClick={() => setCameraOpen(true)}>
                  <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />Retake
                </Button>
                <Button type="button" variant="outline" className="min-h-11" onClick={removePhoto}>
                  <X className="mr-2 h-4 w-4" aria-hidden="true" />Remove
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                className="min-h-11"
                disabled={!cameraAvailable}
                onClick={() => setCameraOpen(true)}
              >
                <Camera className="mr-2 h-4 w-4" aria-hidden="true" />Take photo
              </Button>
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                disabled={isPreparingPhoto}
                onClick={openFilePicker}
              >
                <ImagePlus className="mr-2 h-4 w-4" aria-hidden="true" />
                {isPreparingPhoto ? "Preparing photo…" : "Upload photo"}
              </Button>
              <input
                ref={fileInputRef}
                id="patient-photo-upload"
                type="file"
                accept="image/jpeg,image/png,image/webp,.heic,.heif"
                className="sr-only"
                aria-label="Upload patient photo"
                onChange={(event) => { void handleUpload(event.currentTarget.files?.[0]); }}
              />
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

      <div className="flex justify-end">
        <Button type="submit" disabled={form.formState.isSubmitting || isPreparingPhoto}>
          {form.formState.isSubmitting ? "Saving..." : submitLabel}
        </Button>
      </div>
      {cameraOpen ? (
        <PatientPhotoCamera
          onClose={closeCamera}
          onUsePhoto={useCapturedPhoto}
        />
      ) : null}
    </form>
  );
}
