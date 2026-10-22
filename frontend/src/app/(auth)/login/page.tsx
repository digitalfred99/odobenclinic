"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { PhoneInput } from "@/components/ui/phone-input";
import { Input } from "@/components/ui/input";
import { getPhoneNumberError } from "@/lib/phone";
import { consumeSignInNotice } from "@/lib/session";

const loginSchema = z.object({
  phone: z.string().superRefine((phone, context) => {
    const error = getPhoneNumberError(phone, true);
    if (error) {
      context.addIssue({ code: "custom", message: error });
    }
  }),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;
const GENERIC_LOGIN_ERROR = "Incorrect phone number or password.";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [signInNotice, setSignInNotice] = useState<string | null>(null);

  useEffect(() => {
    // Read the one-time notice after hydration to avoid server/client markup differences.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSignInNotice(consumeSignInNotice());
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: {
      phone: "",
      password: "",
    },
  });

  const onSubmit = async (values: LoginFormValues) => {
    setSubmitError(null);
    setIsSubmitting(true);

    try {
      await login(values.phone, values.password);
      router.replace("/dashboard");
    } catch {
      setSubmitError(GENERIC_LOGIN_ERROR);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="login-background flex min-h-screen items-center justify-center px-4 py-8">
      <div className="w-full max-w-md rounded-2xl border border-border bg-background p-6 shadow-sm sm:p-8">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Odoben Health Center</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">Welcome back</h1>
          <p className="mt-2 text-sm text-muted-foreground">Sign in to manage patients and OPD visits.</p>
        </div>

        {signInNotice ? (
          <p role="status" className="mb-5 rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
            {signInNotice}
          </p>
        ) : null}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="space-y-2">
            <label htmlFor="phone" className="text-sm font-medium text-foreground">
              Phone
            </label>
            <PhoneInput
              id="phone"
              autoComplete="username"
              required
              error={errors.phone?.message}
              aria-invalid={Boolean(errors.phone)}
              {...register("phone", { onChange: () => setSubmitError(null) })}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium text-foreground">
              Password
            </label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="Enter password"
              aria-invalid={Boolean(errors.password)}
              {...register("password", { onChange: () => setSubmitError(null) })}
            />
            {errors.password ? <p className="text-sm text-destructive">{errors.password.message}</p> : null}
          </div>

          {submitError ? (
            <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {submitError}
            </div>
          ) : null}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Signing in..." : "Sign in"}
          </Button>
        </form>
      </div>
    </main>
  );
}
