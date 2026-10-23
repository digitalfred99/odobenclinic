"use client";

import { useState } from "react";
import { ChangePasswordDialog } from "@/components/auth/change-password-dialog";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { getPhoneNumberError, sanitizePhoneNumber } from "@/lib/phone";
import { scheduleScrollToFirstInvalidField } from "@/lib/scroll-to-first-invalid-field";
import { displayRoleLabel } from "@/types/auth";

function buildProfileForm(profile?: { firstName?: string; lastName?: string; phone?: string | null; email?: string | null } | null) {
  return {
    firstName: profile?.firstName ?? "",
    lastName: profile?.lastName ?? "",
    phone: sanitizePhoneNumber(profile?.phone ?? ""),
    email: profile?.email ?? "",
  };
}

export default function ProfilePage() {
  const { user } = useAuth();
  const [formState, setFormState] = useState(() => buildProfileForm(user));
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSuccess(null);
    setError(null);
    const phoneValidationError = getPhoneNumberError(formState.phone);
    if (phoneValidationError) {
      setPhoneError(phoneValidationError);
      scheduleScrollToFirstInvalidField(event.currentTarget);
      return;
    }
    setPhoneError(null);

    if (!user?.id) {
      return;
    }

    try {
      await apiRequest(`/users/${user.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          firstName: formState.firstName.trim(),
          lastName: formState.lastName.trim(),
          phone: formState.phone.trim() || undefined,
          email: formState.email.trim() || undefined,
        }),
      });

      setSuccess("Profile updated successfully.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to update profile.";
      setError(message);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Profile</p>
        <h2 className="mt-2 text-3xl font-semibold text-foreground">Your account</h2>
      </div>

      {success ? <FeedbackMessage message={success} kind="success" onDismiss={() => setSuccess(null)} /> : null}
      {error ? <FeedbackMessage message={error} kind="error" onDismiss={() => setError(null)} /> : null}

      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-xl font-semibold text-foreground">{user?.firstName} {user?.lastName}</h3>
            <p className="text-sm text-muted-foreground">{displayRoleLabel(user?.role)}</p>
          </div>
          <Button type="button" variant="secondary" onClick={() => setChangePasswordOpen(true)}>
            Change password
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="profile-first-name" className="text-sm font-medium text-foreground">First name</label>
            <Input
              id="profile-first-name"
              autoComplete="given-name"
              value={formState.firstName}
              onChange={(event) => setFormState((current) => ({ ...current, firstName: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="profile-last-name" className="text-sm font-medium text-foreground">Last name</label>
            <Input
              id="profile-last-name"
              autoComplete="family-name"
              value={formState.lastName}
              onChange={(event) => setFormState((current) => ({ ...current, lastName: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="profile-phone" className="text-sm font-medium text-foreground">Phone</label>
            <PhoneInput
              id="profile-phone"
              value={formState.phone}
              error={phoneError ?? undefined}
              aria-invalid={Boolean(phoneError)}
              onChange={(event) => {
                setFormState((current) => ({ ...current, phone: event.target.value }));
                setPhoneError(null);
              }}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="profile-email" className="text-sm font-medium text-foreground">Email</label>
            <Input
              id="profile-email"
              type="email"
              autoComplete="email"
              value={formState.email}
              onChange={(event) => setFormState((current) => ({ ...current, email: event.target.value }))}
            />
          </div>
          <div className="md:col-span-2 flex justify-end">
            <Button type="submit">Save profile</Button>
          </div>
        </form>
      </div>
      <ChangePasswordDialog open={changePasswordOpen} onOpenChange={setChangePasswordOpen} />
    </div>
  );
}
