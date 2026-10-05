"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Camera, LoaderCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCamera } from "@/hooks/use-camera";

type PatientPhotoCameraProps = {
  onClose: () => void;
  onUsePhoto: (photo: File) => void;
};

export default function PatientPhotoCamera({ onClose, onUsePhoto }: PatientPhotoCameraProps) {
  const {
    videoRef,
    isStarting,
    videoReady,
    error,
    capturedPhoto,
    isLiveMode,
    isFrontFacing,
    hasMultipleCameras,
    showFlash,
    captureError,
    handleVideoReady,
    capturePhoto,
    retakePhoto,
    switchCamera,
    retry,
  } = useCamera();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  useEffect(() => () => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
    }
  }, []);

  const handleCapture = useCallback(async () => {
    const photo = await capturePhoto();
    if (!photo) {
      return;
    }

    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
    }
    previewUrlRef.current = URL.createObjectURL(photo);
    setPreviewUrl(previewUrlRef.current);
  }, [capturePhoto]);

  const handleRetake = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setPreviewUrl(null);
    retakePhoto();
  }, [retakePhoto]);

  const handleUsePhoto = useCallback(() => {
    if (capturedPhoto) {
      onUsePhoto(capturedPhoto);
    }
  }, [capturedPhoto, onUsePhoto]);

  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[100] bg-foreground/50 backdrop-blur-sm" />
        <Dialog.Popup
          role="dialog"
          aria-modal="true"
          aria-labelledby="patient-camera-title"
          className="fixed inset-0 z-[101] flex max-h-[100dvh] w-full flex-col overflow-y-auto bg-card p-3 text-card-foreground outline-none sm:inset-auto sm:left-1/2 sm:top-1/2 sm:h-auto sm:max-h-[calc(100dvh-2rem)] sm:w-[calc(100%-2rem)] sm:max-w-2xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:border sm:border-border sm:p-5 sm:shadow-xl"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <Dialog.Title id="patient-camera-title" className="text-lg font-semibold text-foreground">
                Take patient photo
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                Center the face in the guide and make sure the area is well lit.
              </Dialog.Description>
            </div>
            <Button type="button" variant="ghost" className="min-h-11 min-w-11" onClick={onClose}>
              Cancel
            </Button>
          </div>

          <div className="relative mx-auto mt-3 w-full max-w-xl overflow-hidden rounded-xl bg-foreground sm:mt-4">
            <div className="relative aspect-[4/3] max-h-[42dvh] w-full overflow-hidden bg-foreground sm:max-h-[48dvh]">
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                onLoadedMetadata={handleVideoReady}
                onCanPlay={handleVideoReady}
                className={`absolute inset-0 h-full w-full object-cover ${isFrontFacing ? "scale-x-[-1]" : ""} ${isLiveMode ? "" : "invisible"}`}
                aria-label="Live patient camera preview"
              />
              {!isLiveMode && previewUrl ? (
                <Image
                  src={previewUrl}
                  alt="Captured patient photo preview"
                  width={1024}
                  height={768}
                  unoptimized
                  className="absolute inset-0 h-full w-full object-contain"
                />
              ) : null}
              {isLiveMode ? (
                <>
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden="true">
                    <div className="h-[78%] w-[54%] rounded-[50%] border-2 border-background/80 shadow-[0_0_0_999px_color-mix(in_srgb,var(--foreground)_18%,transparent)]" />
                  </div>
                  {showFlash ? <div className="pointer-events-none absolute inset-0 bg-background" aria-hidden="true" /> : null}
                </>
              ) : null}
            </div>
            {isLiveMode && isStarting ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-foreground/70 text-background" role="status" aria-live="polite">
                <LoaderCircle className="h-7 w-7 animate-spin" aria-hidden="true" />
                <span className="text-sm">Starting camera…</span>
              </div>
            ) : null}
            {isLiveMode && error ? (
              <div className="absolute inset-x-3 top-3 rounded-lg border border-destructive/30 bg-card p-3 text-sm text-foreground shadow-lg" role="alert">
                <p>{error}</p>
                <Button type="button" variant="secondary" className="mt-2 min-h-11" onClick={retry}>
                  Try again
                </Button>
              </div>
            ) : null}
          </div>

          <p className="sr-only" aria-live="polite">
            {isLiveMode ? "Camera is ready to capture when the preview is clear." : "Photo captured. Review the image before using it."}
          </p>
          <div className="mx-auto mt-3 w-full max-w-xl sm:mt-4">
            {captureError ? (
              <p className="mb-2 text-sm text-destructive" role="alert">{captureError}</p>
            ) : null}
            {!isLiveMode ? (
              <>
                <p className="mb-3 text-sm text-muted-foreground">Make sure the face is clear, well lit, and in focus.</p>
                <div className="grid grid-cols-2 gap-2">
                  <Button type="button" variant="secondary" className="min-h-11" onClick={handleRetake}>
                    <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />Retake
                  </Button>
                  <Button type="button" className="min-h-11" disabled={!capturedPhoto} onClick={handleUsePhoto}>
                    Use photo
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2">
                {hasMultipleCameras ? (
                  <Button type="button" variant="secondary" className="min-h-11" onClick={() => void switchCamera()}>
                    <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />Switch camera
                  </Button>
                ) : <span />}
                <Button
                  type="button"
                  className="min-h-11 min-w-32"
                  disabled={!videoReady || isStarting || Boolean(error)}
                  onClick={() => void handleCapture()}
                >
                  <Camera className="mr-2 h-4 w-4" aria-hidden="true" />Capture
                </Button>
              </div>
            )}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
