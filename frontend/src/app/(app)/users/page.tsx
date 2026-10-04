"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Plus, Search, X } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { sanitizePhoneNumber } from "@/lib/phone";
import type { ClinicUser, UsersListResponse } from "@/types/user";

const EMPTY_FORM = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  password: "",
  role: "receptionist" as "admin" | "receptionist",
};

type UserConfirmation = {
  action: "delete" | "status";
  targetUser: ClinicUser;
};

export default function UsersPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "super_admin";
  const canManageUsers = user?.role === "admin" || isSuperAdmin;
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState("");
  const [page, setPage] = useState(1);
  const [formState, setFormState] = useState(EMPTY_FORM);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<UserConfirmation | null>(null);
  const [confirmationError, setConfirmationError] = useState<string | null>(null);

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (roleFilter) params.set("role", roleFilter);
    if (activeFilter) params.set("isActive", activeFilter);
    params.set("page", String(page));
    params.set("limit", "20");
    return params;
  }, [activeFilter, page, roleFilter, search]);

  const { data, isLoading, error: queryError, refetch } = useQuery({
    queryKey: ["users", queryParams.toString()],
    queryFn: async () => apiRequest<UsersListResponse>(`/users?${queryParams.toString()}`),
  });

  const users = data?.users ?? [];
  const totalPages = data?.pagination?.totalPages ?? 1;

  const submitUser = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSuccess(null);
    setError(null);

    try {
      const payload = {
        firstName: formState.firstName.trim(),
        lastName: formState.lastName.trim(),
        email: formState.email.trim() || undefined,
        phone: formState.phone.trim(),
        password: formState.password,
        role: formState.role,
      };

      if (editingUserId) {
        await apiRequest(`/users/${editingUserId}`, {
          method: "PATCH",
          body: JSON.stringify({
            firstName: payload.firstName,
            lastName: payload.lastName,
            phone: payload.phone,
            email: payload.email,
            password: payload.password || undefined,
          }),
        });
        setSuccess("User updated successfully.");
      } else {
        await apiRequest("/users", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setSuccess("User created successfully.");
      }

      setFormState(EMPTY_FORM);
      setEditingUserId(null);
      await refetch();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to save user.";
      setError(message);
    }
  };

  const startEdit = (targetUser: ClinicUser) => {
    setEditingUserId(targetUser.id);
    setFormState({
      firstName: targetUser.firstName,
      lastName: targetUser.lastName,
      email: targetUser.email ?? "",
      phone: sanitizePhoneNumber(targetUser.phone ?? ""),
      password: "",
      role: targetUser.role,
    });
    setSuccess(null);
    setError(null);
  };

  const cancelEdit = () => {
    setEditingUserId(null);
    setFormState(EMPTY_FORM);
  };

  const confirmUserAction = async () => {
    if (!confirmation) {
      return;
    }

    const { action, targetUser } = confirmation;
    if (action === "delete") {
      await apiRequest("/users", {
        method: "DELETE",
        body: JSON.stringify({ ids: [targetUser.id] }),
      });

      await refetch();
      if (editingUserId === targetUser.id) {
        cancelEdit();
      }
      return;
    }

    await apiRequest(`/users/${targetUser.id}/${targetUser.isActive ? "deactivate" : "activate"}`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    await refetch();
  };

  const openConfirmation = (action: UserConfirmation["action"], targetUser: ClinicUser) => {
    setError(null);
    setConfirmationError(null);
    setConfirmation({ action, targetUser });
  };

  const handleConfirmationError = (action: UserConfirmation["action"], actionError: unknown) => {
    const fallbackMessage = action === "delete" ? "Unable to delete user." : "Unable to update user status.";
    const message = actionError instanceof Error ? actionError.message : fallbackMessage;
    setError(message);
    setConfirmationError(message);
  };

  const confirmationName = confirmation
    ? `${confirmation.targetUser.firstName} ${confirmation.targetUser.lastName}`.trim()
    : "";
  const isDeleteConfirmation = confirmation?.action === "delete";
  const isDeactivation = confirmation?.action === "status" && confirmation.targetUser.isActive;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Users</p>
          <h2 className="mt-2 text-3xl font-semibold text-foreground">Clinic staff</h2>
        </div>
      </div>

      {success ? <FeedbackMessage message={success} kind="success" onDismiss={() => setSuccess(null)} /> : null}
      {error ? <FeedbackMessage message={error} kind="error" onDismiss={() => setError(null)} /> : null}

      {canManageUsers ? (
        <form onSubmit={submitUser} className="space-y-5 rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2 text-primary">
            <Plus className="h-4 w-4" />
            <span className="text-sm font-medium">{editingUserId ? "Edit user" : "Create user"}</span>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
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
              <PhoneInput
                value={formState.phone}
                required={!editingUserId}
                onChange={(event) => setFormState((current) => ({ ...current, phone: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Email</label>
              <Input type="email" value={formState.email} onChange={(event) => setFormState((current) => ({ ...current, email: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Password</label>
              <Input type="password" value={formState.password} onChange={(event) => setFormState((current) => ({ ...current, password: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Role</label>
              <select
                value={formState.role}
                onChange={(event) => setFormState((current) => ({ ...current, role: event.target.value as "admin" | "receptionist" }))}
                className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              >
                {isSuperAdmin ? <option value="admin">Admin</option> : null}
                <option value="receptionist">Receptionist</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            {editingUserId ? (
              <Button type="button" variant="secondary" onClick={cancelEdit}>Cancel</Button>
            ) : null}
            <Button type="submit">{editingUserId ? "Save changes" : "Create user"}</Button>
          </div>
        </form>
      ) : null}

      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-4 grid gap-3 md:grid-cols-[1.5fr_0.8fr_0.8fr]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder="Search users" />
          </div>
          <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
            <option value="">All roles</option>
            <option value="admin">Admin</option>
            <option value="receptionist">Receptionist</option>
          </select>
          <select value={activeFilter} onChange={(event) => setActiveFilter(event.target.value)} className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
            <option value="">All status</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>

        {queryError ? <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">Unable to load users.</div> : null}

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((item) => <div key={item} className="h-14 animate-pulse rounded-xl bg-muted" />)}
          </div>
        ) : users.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No users match the current filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="px-3 py-3 font-medium">Name</th>
                  <th className="px-3 py-3 font-medium">Role</th>
                  <th className="px-3 py-3 font-medium">Phone</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-3 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((singleUser) => (
                  <tr key={singleUser.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-3 font-medium text-foreground">{singleUser.firstName} {singleUser.lastName}</td>
                    <td className="px-3 py-3 capitalize text-foreground">{singleUser.role}</td>
                    <td className="px-3 py-3 text-foreground">{singleUser.phone ?? "—"}</td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${singleUser.isActive ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
                        {singleUser.isActive ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />} {singleUser.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      {canManageUsers ? (
                        <div className="flex flex-wrap gap-2">
                          <Button type="button" variant="secondary" size="sm" onClick={() => startEdit(singleUser)}>Edit</Button>
                          <Button type="button" variant="secondary" size="sm" onClick={() => openConfirmation("status", singleUser)}>
                            {singleUser.isActive ? "Deactivate" : "Activate"}
                          </Button>
                          <Button type="button" variant="destructive" size="sm" onClick={() => openConfirmation("delete", singleUser)}>Delete</Button>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {users.length > 0 ? (
          <div className="mt-5 flex items-center justify-between gap-3 text-sm text-muted-foreground">
            <span>Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</Button>
              <Button type="button" variant="secondary" disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>Next</Button>
            </div>
          </div>
        ) : null}
      </div>

      <ConfirmationDialog
        open={confirmation !== null}
        title={isDeleteConfirmation ? "Delete account?" : isDeactivation ? "Deactivate account?" : "Activate account?"}
        description={isDeleteConfirmation
          ? `${confirmationName} will be soft-deleted and removed from active user lists.`
          : isDeactivation
            ? `${confirmationName} will no longer be able to sign in. You can reactivate the account later.`
            : `${confirmationName} will regain sign-in access to the application.`}
        confirmLabel={isDeleteConfirmation ? "Delete account" : isDeactivation ? "Deactivate account" : "Activate account"}
        intent={isDeleteConfirmation || isDeactivation ? "destructive" : "default"}
        errorMessage={confirmationError}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmation(null);
            setConfirmationError(null);
          }
        }}
        onConfirm={confirmUserAction}
        onError={(actionError) => handleConfirmationError(confirmation?.action ?? "delete", actionError)}
      />
    </div>
  );
}
