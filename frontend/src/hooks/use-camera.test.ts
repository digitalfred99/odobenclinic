import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCamera } from "./use-camera";

const secureContextDescriptor = Object.getOwnPropertyDescriptor(window, "isSecureContext");

function createStream(deviceId: string, facingMode: "user" | "environment"): MediaStream {
  const track = {
    stop: vi.fn(),
    getSettings: () => ({ deviceId, facingMode }),
  };
  return {
    getTracks: () => [track],
    getVideoTracks: () => [track],
  } as unknown as MediaStream;
}

function createDevice(deviceId: string): MediaDeviceInfo {
  return { deviceId, kind: "videoinput" } as MediaDeviceInfo;
}

function mockCameraDevices(
  getUserMedia: ReturnType<typeof vi.fn>,
  devices: MediaDeviceInfo[],
) {
  vi.stubGlobal("navigator", {
    mediaDevices: {
      getUserMedia,
      enumerateDevices: vi.fn().mockResolvedValue(devices),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    },
  });
  Object.defineProperty(window, "isSecureContext", { configurable: true, value: true });
}

afterEach(() => {
  vi.unstubAllGlobals();
  if (secureContextDescriptor) {
    Object.defineProperty(window, "isSecureContext", secureContextDescriptor);
  } else {
    Reflect.deleteProperty(window, "isSecureContext");
  }
});

describe("useCamera", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts with the rear-facing camera when available", async () => {
    const getUserMedia = vi.fn().mockResolvedValue(createStream("rear-camera", "environment"));
    mockCameraDevices(getUserMedia, [createDevice("rear-camera"), createDevice("front-camera")]);

    const { result } = renderHook(() => useCamera());

    await waitFor(() => expect(result.current.isStarting).toBe(false));
    expect(getUserMedia).toHaveBeenCalledWith(
      expect.objectContaining({
        video: expect.objectContaining({ facingMode: "environment" }),
      }),
    );
    expect(result.current.isFrontFacing).toBe(false);
    expect(result.current.hasMultipleCameras).toBe(true);
  });

  it("falls back to the front-facing camera on front-camera-only devices", async () => {
    const getUserMedia = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error("Rear camera unavailable"), { name: "NotFoundError" }))
      .mockResolvedValueOnce(createStream("front-camera", "user"));
    mockCameraDevices(getUserMedia, [createDevice("front-camera")]);

    const { result } = renderHook(() => useCamera());

    await waitFor(() => expect(result.current.isStarting).toBe(false));
    expect(getUserMedia).toHaveBeenCalledTimes(2);
    expect(getUserMedia.mock.calls[0][0].video.facingMode).toBe("environment");
    expect(getUserMedia.mock.calls[1][0].video.facingMode).toBe("user");
    expect(result.current.isFrontFacing).toBe(true);
    expect(result.current.hasMultipleCameras).toBe(false);
  });

  it("switches directly to the opposite facing mode instead of cycling device IDs", async () => {
    const getUserMedia = vi.fn()
      .mockResolvedValueOnce(createStream("rear-wide", "environment"))
      .mockResolvedValueOnce(createStream("front-camera", "user"))
      .mockResolvedValueOnce(createStream("rear-ultrawide", "environment"));
    mockCameraDevices(getUserMedia, [
      createDevice("rear-wide"),
      createDevice("rear-ultrawide"),
      createDevice("front-camera"),
    ]);

    const { result } = renderHook(() => useCamera());

    await waitFor(() => expect(result.current.isStarting).toBe(false));
    await act(async () => result.current.switchCamera());
    expect(getUserMedia.mock.calls[1][0].video.facingMode).toEqual({ exact: "user" });
    expect(result.current.isFrontFacing).toBe(true);

    await act(async () => result.current.switchCamera());
    expect(getUserMedia.mock.calls[2][0].video.facingMode).toEqual({ exact: "environment" });
    expect(result.current.isFrontFacing).toBe(false);
  });
});
