"use client";

import { useRef, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Eye, EyeOff, LoaderCircle } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { PasswordRequirements } from "@/components/auth/password-requirements";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError, changePassword } from "@/lib/api";
import {
  getPasswordPolicyError,
  isStrongPassword,
  PASSWORD_STRENGTH_MESSAGE,
} from "@/lib/password";
import { setSignInNotice } from "@/lib/session";
import { scheduleScrollToFirstInvalidField } from "@/lib/scroll-to-first-invalid-field";

type ChangePasswordDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type PasswordFields = "currentPassword" | "newPassword" | "confirmPassword";
type PasswordValues = Record<PasswordFields, string>;
type PasswordErrors = Partial<Record<PasswordFields, string>>;

const EMPTY_VALUES: PasswordValues = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

const FIELD_LABELS: Record<PasswordFields, string> = {
  currentPassword: "Current password",
  newPassword: "New password",
  confirmPassword: "Confirm new password",
};

export function ChangePasswordDialog({ open, onOpenChange }: ChangePasswordDialogProps) {
  const { logout } = useAuth();
  const [values, setValues] = useState(EMPTY_VALUES);
  const [errors, setErrors] = useState<PasswordErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [visibleFields, setVisibleFields] = useState<Partial<Record<PasswordFields, boolean>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const clearForm = () => {
    setValues(EMPTY_VALUES);
    setErrors({});
    setFormError(null);
    setVisibleFields({});
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (isSubmitting) {
      return;
    }
    if (!nextOpen) {
      clearForm();
    }
    onOpenChange(nextOpen);
  };

  const updateField = (field: PasswordFields, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setFormError(null);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrors({});
    setFormError(null);

    const nextErrors: PasswordErrors = {};
    if (!values.currentPassword) nextErrors.currentPassword = "Current password is required.";
    if (!values.newPassword) nextErrors.newPassword = "New password is required.";
    if (!values.confirmPassword) nextErrors.confirmPassword = "Please confirm your new password.";
    const passwordPolicyError = values.newPassword
      ? getPasswordPolicyError(values.newPassword)
      : null;
    if (passwordPolicyError) {
      nextErrors.newPassword = passwordPolicyError;
    } else if (values.newPassword && !isStrongPassword(values.newPassword)) {
      nextErrors.newPassword = PASSWORD_STRENGTH_MESSAGE;
    } else if (values.newPassword && values.newPassword === values.currentPassword) {
      nextErrors.newPassword = "Your new password must be different from your current password.";
    }
    if (values.confirmPassword && values.confirmPassword !== values.newPassword) {
      nextErrors.confirmPassword = "Passwords do not match.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      scheduleScrollToFirstInvalidField(formRef.current);
      return;
    }

    setIsSubmitting(true);
    try {
      await changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      setSignInNotice("Password changed. Please sign in again.");
      await logout();
    } catch (error) {
      if (error instanceof ApiError && error.code === "invalid_current_password") {
        setErrors({ currentPassword: error.message });
        scheduleScrollToFirstInvalidField(formRef.current);
      } else if (error instanceof ApiError && error.code === "same_password") {
        setErrors({ newPassword: error.message });
        scheduleScrollToFirstInvalidField(formRef.current);
      } else if (error instanceof Error && /password/i.test(error.message)) {
        setErrors({ newPassword: error.message });
        scheduleScrollToFirstInvalidField(formRef.current);
      } else if (error instanceof ApiError && error.status === 429) {
        setFormError("Too many attempts, please try again later");
      } else {
        setFormError(error instanceof Error ? error.message : "Unable to change password.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog.Root open={open} modal onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="pointer-events-auto touch-none fixed inset-0 z-[100] bg-foreground/40 backdrop-blur-sm" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-[101] max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-border bg-card p-6 text-card-foreground shadow-xl outline-none">
          <Dialog.Title className="text-lg font-semibold text-foreground">Change password</Dialog.Title>
          <Dialog.Description className="mt-2 text-sm leading-6 text-muted-foreground">
            Choose a new password to secure your account. You will need to sign in again on all devices.
          </Dialog.Description>

          <form ref={formRef} onSubmit={(event) => void handleSubmit(event)} className="mt-5 space-y-4">
            {(["currentPassword", "newPassword", "confirmPassword"] as const).map((field) => {
              const visible = Boolean(visibleFields[field]);
              const inputId = `change-password-${field}`;
              const errorId = `${inputId}-error`;
              return (
                <div key={field} className="space-y-2">
                  <label htmlFor={inputId} className="text-sm font-medium text-foreground">{FIELD_LABELS[field]}</label>
                  <div className="relative">
                    <Input
                      id={inputId}
                      type={visible ? "text" : "password"}
                      autoComplete={field === "currentPassword" ? "current-password" : "new-password"}
                      value={values[field]}
                      onChange={(event) => updateField(field, event.target.value)}
                      aria-invalid={Boolean(errors[field])}
                      aria-describedby={errors[field] ? errorId : field === "newPassword" ? "change-password-strength" : undefined}
                      disabled={isSubmitting}
                      className="pr-12"
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center rounded-r-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label={`${visible ? "Hide" : "Show"} ${FIELD_LABELS[field].toLowerCase()}`}
                      aria-pressed={visible}
                      onClick={() => setVisibleFields((current) => ({ ...current, [field]: !current[field] }))}
                      disabled={isSubmitting}
                    >
                      {visible
                        ? <EyeOff className="h-4 w-4" aria-hidden="true" />
                        : <Eye className="h-4 w-4" aria-hidden="true" />}
                    </button>
                  </div>
                  {field === "newPassword" ? (
                    <PasswordRequirements
                      id="change-password-strength"
                      password={values.newPassword}
                      variant="auth"
                    />
                  ) : null}
                  {errors[field] ? <p id={errorId} className="text-sm text-destructive" role="alert">{errors[field]}</p> : null}
                </div>
              );
            })}

            {formError ? <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{formError}</p> : null}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" disabled={isSubmitting} onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                {isSubmitting ? "Changing password..." : "Change password"}
              </Button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
