import { fireEvent, render, screen } from "@testing-library/react";
import { Dialog } from "@base-ui/react/dialog";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/use-camera", () => ({
  useCamera: () => ({
    videoRef: { current: null },
    isStarting: false,
    isSwitching: false,
    videoReady: true,
    error: null,
    capturedPhoto: null,
    isLiveMode: true,
    isFrontFacing: true,
    hasMultipleCameras: false,
    showFlash: false,
    captureError: null,
    handleVideoReady: vi.fn(),
    capturePhoto: vi.fn(),
    retakePhoto: vi.fn(),
    switchCamera: vi.fn(),
    retry: vi.fn(),
  }),
}));

import PatientPhotoCamera from "./patient-photo-camera";

describe("PatientPhotoCamera modal overlay", () => {
  it("renders a full-screen overlay above a parent registration dialog", () => {
    render(
      <Dialog.Root open>
        <Dialog.Portal>
          <Dialog.Popup>
            <button type="button">Registration background action</button>
            <PatientPhotoCamera onClose={vi.fn()} onUsePhoto={vi.fn()} />
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    );

    const backgroundAction = screen.getByText("Registration background action");
    expect(backgroundAction.closest('[role="dialog"]')).toHaveAttribute("aria-hidden", "true");
    const cameraDialog = screen.getByRole("dialog", { name: "Take patient photo" });
    expect(cameraDialog).toBeInTheDocument();
    expect(document.querySelector(".patient-camera-backdrop")).toHaveClass(
      "pointer-events-auto",
      "fixed",
      "inset-0"
    );
  });

  it("does not close when the overlay is pressed", () => {
    const onClose = vi.fn();
    render(
      <Dialog.Root open>
        <Dialog.Portal>
          <Dialog.Popup>
            <PatientPhotoCamera onClose={onClose} onUsePhoto={vi.fn()} />
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    );

    fireEvent.click(document.querySelector(".patient-camera-backdrop") as HTMLElement);
    expect(onClose).not.toHaveBeenCalled();
  });
});
