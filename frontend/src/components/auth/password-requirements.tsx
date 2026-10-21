import { CheckCircle2, Circle } from "lucide-react";
import {
  getAuthPasswordRequirements,
  getPasswordRequirements,
  isStrongPassword,
  isUserPasswordValid,
} from "@/lib/password";

type PasswordRequirementsProps = {
  id: string;
  password: string;
  variant?: "user" | "auth";
};

export function PasswordRequirements({ id, password, variant = "user" }: PasswordRequirementsProps) {
  const requirements = variant === "auth"
    ? getAuthPasswordRequirements(password)
    : getPasswordRequirements(password);
  const isComplete = variant === "auth"
    ? isStrongPassword(password)
    : isUserPasswordValid(password);

  return (
    <section
      id={id}
      aria-label="Password requirements"
      className="space-y-2"
    >
      {password.length > 0 && isComplete ? (
        <p className="text-xs font-medium text-success">All set! This password is ready.</p>
      ) : null}
      <ul className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
        {requirements.map((requirement) => (
          <li
            key={requirement.id}
            className={`flex min-w-0 items-center gap-2 text-xs ${
              requirement.met ? "font-medium text-success" : "text-muted-foreground"
            }`}
          >
            {requirement.met ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            ) : (
              <Circle className="h-4 w-4 shrink-0" aria-hidden="true" />
            )}
            <span>
              {requirement.label}
              <span className="sr-only">{requirement.met ? " — met" : " — not met"}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
