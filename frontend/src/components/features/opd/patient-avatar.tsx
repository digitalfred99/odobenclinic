"use client";

import Image from "next/image";
import { useState } from "react";
import { UserRound } from "lucide-react";
import { resolvePatientPhotoUrl } from "@/lib/patient-photo";
import type { Patient } from "@/types/patient";

export function PatientAvatar({
  patient,
  size,
}: {
  patient: Patient;
  size: "small" | "medium" | "large";
}) {
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  const dimensions = size === "small"
    ? { container: "h-10 w-10", image: 40, icon: "h-5 w-5" }
    : size === "medium"
      ? { container: "h-11 w-11", image: 44, icon: "h-5 w-5" }
      : { container: "h-14 w-14", image: 56, icon: "h-7 w-7" };
  const hasPhoto = Boolean(patient.imageUrl) && failedImageUrl !== patient.imageUrl;

  return (
    <span
      aria-hidden="true"
      className={`relative flex ${dimensions.container} shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-primary`}
    >
      {patient.imageUrl && hasPhoto ? (
        <Image
          src={resolvePatientPhotoUrl(patient.imageUrl)}
          alt=""
          width={dimensions.image}
          height={dimensions.image}
          unoptimized
          className="absolute inset-0 h-full w-full object-cover"
          onError={() => setFailedImageUrl(patient.imageUrl ?? null)}
        />
      ) : (
        <UserRound className={dimensions.icon} aria-hidden="true" />
      )}
    </span>
  );
}
