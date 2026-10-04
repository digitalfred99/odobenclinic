"use client";

import { useState } from "react";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { sanitizePhoneNumber } from "@/lib/phone";
import { displayRoleLabel } from "@/types/auth";

function buildProfileForm(profile?: { firstName?: string; lastName?: string; phone?: string | null; email?: string | null } | null) {
  return {
    firstName: profile?.firstName ?? "",
    lastName: profile?.lastName ?? "",
    phone: sanitizePhoneNumber(profile?.phone ?? ""),
    email: profile?.email ?? "",
    password: "",
  };
}

export default function ProfilePage() {
  const { user } = useAuth();
  const [formState, setFormState] = useState(() => buildProfileForm(user));
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSuccess(null);
    setError(null);

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
          password: formState.password || undefined,
        }),
      });

      setSuccess("Profile updated successfully.");
      setFormState((current) => ({ ...current, password: "" }));
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
        </div>

        <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">First name</label>
            <Input value={formState.firstName} onChange={(event) => setFormState((current) => ({ ...current, firstName: event.target.value }))} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Last name</label>
            <Input value={formState.lastName} onChange={(event) => setFormState((current) => ({ ...current, lastName: event.target.value }))} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Phone</label>
            <PhoneInput value={formState.phone} onChange={(event) => setFormState((current) => ({ ...current, phone: event.target.value }))} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Email</label>
            <Input type="email" value={formState.email} onChange={(event) => setFormState((current) => ({ ...current, email: event.target.value }))} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium text-foreground">New password</label>
            <Input type="password" value={formState.password} onChange={(event) => setFormState((current) => ({ ...current, password: event.target.value }))} placeholder="Leave blank to keep the current password" />
          </div>

          <div className="md:col-span-2 flex justify-end">
            <Button type="submit">Save profile</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
