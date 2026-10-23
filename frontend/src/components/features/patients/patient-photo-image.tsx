"use client";

import Image from "next/image";
import { useState } from "react";
import { UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

type PatientPhotoImageProps = {
  src: string;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
  fill?: boolean;
  sizes?: string;
};

export function PatientPhotoImage({
  src,
  alt,
  className,
  width,
  height,
  fill = false,
  sizes,
}: PatientPhotoImageProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (failedSrc === src) {
    return (
      <span
        role="img"
        aria-label={`${alt} unavailable`}
        className={cn(
          "inline-flex items-center justify-center overflow-hidden bg-primary/10 text-primary",
          fill && "absolute inset-0 h-full w-full",
          className
        )}
      >
        <UserRound className="h-1/2 w-1/2" aria-hidden="true" />
      </span>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={fill ? undefined : width}
      height={fill ? undefined : height}
      fill={fill}
      sizes={sizes}
      unoptimized
      className={className}
      onError={() => setFailedSrc(src)}
    />
  );
}
