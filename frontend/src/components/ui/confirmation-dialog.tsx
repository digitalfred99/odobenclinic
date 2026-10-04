"use client";

import { useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

type ConfirmationDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  intent?: "default" | "destructive";
  errorMessage?: string | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
  onError?: (error: unknown) => void;
};

export function ConfirmationDialog({
  open,
  title,
  description,
  confirmLabel,
  intent = "destructive",
  errorMessage,
  onOpenChange,
  onConfirm,
  onError,
}: ConfirmationDialogProps) {
  const [isPending, setIsPending] = useState(false);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!isPending) {
      onOpenChange(nextOpen);
    }
  };

  const handleConfirm = async () => {
    if (isPending) {
      return;
    }

    setIsPending(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch (error) {
      onError?.(error);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[100] bg-foreground/40 backdrop-blur-sm" />
        <Dialog.Popup
          role="alertdialog"
          className="fixed left-1/2 top-1/2 z-[101] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card p-6 text-card-foreground shadow-xl outline-none"
        >
          <Dialog.Title className="text-lg font-semibold text-foreground">{title}</Dialog.Title>
          <Dialog.Description className="mt-2 text-sm leading-6 text-muted-foreground">
            {description}
          </Dialog.Description>

          {errorMessage ? (
            <p role="alert" className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {errorMessage}
            </p>
          ) : null}

          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" disabled={isPending} onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" variant={intent} disabled={isPending} onClick={() => void handleConfirm()}>
              {isPending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              {isPending ? "Working..." : confirmLabel}
            </Button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
