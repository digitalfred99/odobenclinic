import { X } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type CloseButtonProps = Omit<ButtonProps, "children" | "size" | "variant"> & {
  "aria-label": string;
};

export function CloseButton({ className, ...props }: CloseButtonProps) {
  return (
    <Button
      {...props}
      variant="ghost"
      size="icon"
      className={cn(
        "min-h-10 min-w-10 shrink-0 rounded-full bg-card text-foreground shadow-md hover:bg-muted",
        className
      )}
    >
      <X className="h-5 w-5" aria-hidden="true" />
    </Button>
  );
}
