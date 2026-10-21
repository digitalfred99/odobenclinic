"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPatientPhotoFromVideo } from "@/lib/patient-photo";

function cameraErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    switch (error.name) {
      case "NotAllowedError":
      case "PermissionDeniedError":
        return "Camera access was denied. Allow camera access in your browser settings, then try again.";
      case "NotFoundError":
      case "DevicesNotFoundError":
        return "No camera was found. Connect a camera or upload a photo instead.";
      case "NotReadableError":
      case "TrackStartError":
        return "The camera is in use by another app. Close that app and try again.";
      case "OverconstrainedError":
      case "ConstraintNotSatisfiedError":
        return "This camera cannot use the requested settings. Try again or switch cameras.";
    }
  }

  return "The camera could not be started. Check your camera connection and try again.";
}

function stopTracks(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const requestIdRef = useRef(0);
  const mountedRef = useRef(false);
  const liveModeRef = useRef(true);
  const selectedDeviceRef = useRef<string | null>(null);
  const selectedFacingModeRef = useRef<"user" | "environment">("environment");
  const switchingRef = useRef(false);
  const flashTimeoutRef = useRef<number | null>(null);
  const [isStarting, setIsStarting] = useState(true);
  const [isSwitching, setIsSwitching] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<File | null>(null);
  const [isLiveMode, setIsLiveMode] = useState(true);
  const [isFrontFacing, setIsFrontFacing] = useState(false);
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  const [showFlash, setShowFlash] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);

  const stopStream = useCallback(() => {
    requestIdRef.current += 1;
    stopTracks(streamRef.current);
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) {
      setHasMultipleCameras(false);
      return [];
    }

    const devices = await navigator.mediaDevices.enumerateDevices();
    const cameras = devices.filter((device) => device.kind === "videoinput");
    setHasMultipleCameras(cameras.length > 1);
    return cameras;
  }, []);

  const startCamera = useCallback(async (
    deviceId?: string,
    fallbackFacingMode: "user" | "environment" = "environment",
    requireFacingMode = false,
  ) => {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setError("Camera needs a secure (HTTPS) connection. You can upload a photo instead.");
      setIsStarting(false);
      return;
    }

    stopTracks(streamRef.current);
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    const requestId = ++requestIdRef.current;
    setIsStarting(true);
    setVideoReady(false);
    setError(null);

    const constraints: MediaStreamConstraints = {
      video: deviceId
        ? {
            deviceId: { exact: deviceId },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          }
        : {
            facingMode: requireFacingMode ? { exact: fallbackFacingMode } : fallbackFacingMode,
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
      audio: false,
    };

    try {
      let stream: MediaStream;
      let activeFacingMode = fallbackFacingMode;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (initialError) {
        const errorName = initialError instanceof Error ? initialError.name : "";
        if (
          !deviceId &&
          !requireFacingMode &&
          fallbackFacingMode === "environment" &&
          (errorName === "OverconstrainedError" || errorName === "NotFoundError")
        ) {
          activeFacingMode = "user";
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: "user",
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
            audio: false,
          });
        } else if (errorName === "OverconstrainedError") {
          stream = await navigator.mediaDevices.getUserMedia({
            video: deviceId
              ? { deviceId: { exact: deviceId } }
              : requireFacingMode
                ? { facingMode: fallbackFacingMode }
                : true,
            audio: false,
          });
        } else {
          throw initialError;
        }
      }

      if (!mountedRef.current || requestId !== requestIdRef.current) {
        stopTracks(stream);
        return;
      }

      streamRef.current = stream;
      const videoTrack = stream.getVideoTracks()[0];
      const settings = videoTrack?.getSettings();
      if (settings?.deviceId) {
        selectedDeviceRef.current = settings.deviceId;
      }
      const actualFacingMode = settings?.facingMode
        ? settings.facingMode === "user" ? "user" : "environment"
        : activeFacingMode;
      selectedFacingModeRef.current = actualFacingMode;
      setIsFrontFacing(actualFacingMode === "user");
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      await refreshDevices();
      setIsStarting(false);
    } catch (cameraError) {
      if (requestId === requestIdRef.current) {
        stopTracks(streamRef.current);
        streamRef.current = null;
        if (videoRef.current) {
          videoRef.current.srcObject = null;
        }
        setError(cameraErrorMessage(cameraError));
        setIsStarting(false);
      }
    }
  }, [refreshDevices]);

  useEffect(() => {
    mountedRef.current = true;
    liveModeRef.current = true;
    let isCurrent = true;
    queueMicrotask(() => {
      if (isCurrent) {
        void startCamera(undefined, "environment");
      }
    });

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        stopStream();
        setVideoReady(false);
      } else if (liveModeRef.current && mountedRef.current) {
        void startCamera(selectedDeviceRef.current ?? undefined, selectedFacingModeRef.current);
      }
    };
    const handleDeviceChange = () => {
      void refreshDevices().catch(() => {
        setError("Unable to check for camera changes. You can continue with the current camera.");
      });
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    navigator.mediaDevices?.addEventListener("devicechange", handleDeviceChange);

    return () => {
      isCurrent = false;
      mountedRef.current = false;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      navigator.mediaDevices?.removeEventListener("devicechange", handleDeviceChange);
      stopStream();
      if (flashTimeoutRef.current !== null) {
        window.clearTimeout(flashTimeoutRef.current);
      }
    };
  }, [refreshDevices, startCamera, stopStream]);

  const handleVideoReady = useCallback(() => {
    if (videoRef.current && videoRef.current.readyState >= 2) {
      setVideoReady(true);
    }
  }, []);

  const capturePhoto = useCallback(async () => {
    const video = videoRef.current;
    if (!video || video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
      setCaptureError("The camera is still starting. Please wait a moment and try again.");
      return null;
    }

    setCaptureError(null);
    try {
      const photo = await createPatientPhotoFromVideo(video, isFrontFacing);
      setCapturedPhoto(photo);
      liveModeRef.current = false;
      setIsLiveMode(false);
      setShowFlash(true);
      if (flashTimeoutRef.current !== null) {
        window.clearTimeout(flashTimeoutRef.current);
      }
      flashTimeoutRef.current = window.setTimeout(() => setShowFlash(false), 140);
      return photo;
    } catch (captureError) {
      setCaptureError(captureError instanceof Error ? captureError.message : "Unable to capture this photo.");
      return null;
    }
  }, [isFrontFacing]);

  const retakePhoto = useCallback(() => {
    setCapturedPhoto(null);
    setCaptureError(null);
    liveModeRef.current = true;
    setIsLiveMode(true);
    if (!streamRef.current) {
      void startCamera(selectedDeviceRef.current ?? undefined, isFrontFacing ? "user" : "environment");
    }
  }, [isFrontFacing, startCamera]);

  const switchCamera = useCallback(async () => {
    if (switchingRef.current) {
      return;
    }

    switchingRef.current = true;
    setIsSwitching(true);
    try {
      const nextFacingMode = isFrontFacing ? "environment" : "user";
      selectedDeviceRef.current = null;
      await startCamera(undefined, nextFacingMode, true);
    } catch {
      setError("Unable to switch cameras. Please try again.");
    } finally {
      switchingRef.current = false;
      setIsSwitching(false);
    }
  }, [isFrontFacing, startCamera]);

  const retry = useCallback(() => {
    void startCamera(selectedDeviceRef.current ?? undefined, isFrontFacing ? "user" : "environment");
  }, [isFrontFacing, startCamera]);

  return {
    videoRef,
    isStarting,
    isSwitching,
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
  };
}
