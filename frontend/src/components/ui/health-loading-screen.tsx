import { HeartPulse } from "lucide-react";

export function HealthLoadingScreen({ label }: { label: string }) {
  return (
    <div
      className="flex min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(ellipse_at_center,_var(--color-secondary),_var(--color-background)_68%)] px-4"
      role="status"
      aria-label={label}
      aria-busy="true"
    >
      <div className="flex flex-col items-center text-center">
        <div className="relative flex h-28 w-28 items-center justify-center">
          <span className="health-pulse-ring absolute inset-2 rounded-full border-2 border-primary/15" aria-hidden="true" />
          <span className="health-pulse-ring health-pulse-ring-delayed absolute inset-2 rounded-full border-2 border-primary/15" aria-hidden="true" />
          <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-card text-primary shadow-lg">
            <HeartPulse className="health-heartbeat h-9 w-9" strokeWidth={1.8} aria-hidden="true" />
          </span>
        </div>
        <p className="mt-4 text-sm font-semibold tracking-wide text-foreground">Odoben Health Center</p>
        <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
          <span>Preparing your care workspace</span>
          <span className="health-loading-dot" aria-hidden="true">.</span>
          <span className="health-loading-dot health-loading-dot-delayed" aria-hidden="true">.</span>
          <span className="health-loading-dot health-loading-dot-later" aria-hidden="true">.</span>
        </p>
      </div>
    </div>
  );
}
