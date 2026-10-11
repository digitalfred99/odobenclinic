export const MAX_PATIENT_PHOTO_SIZE = 5 * 1024 * 1024;

const RESIZE_THRESHOLD = 1.5 * 1024 * 1024;
const MAX_PHOTO_SIDE = 1024;
const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function resolvePatientPhotoUrl(imageUrl: string): string {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api/v1";
  const origin = apiBaseUrl.startsWith("/")
    ? window.location.origin
    : new URL(apiBaseUrl).origin;
  return new URL(imageUrl, origin).toString();
}

export function validatePatientPhoto(file: File): string | null {
  if (/\.(heic|heif)$/i.test(file.name) || /image\/hei[cf]/i.test(file.type)) {
    return "This photo format isn't supported. Please take a photo with the camera or use a JPEG/PNG.";
  }

  if (file.size === 0) {
    return "The selected photo is empty. Please choose another photo.";
  }

  if (file.size > MAX_PATIENT_PHOTO_SIZE) {
    return "Photo must be 5 MB or smaller.";
  }

  if (!ACCEPTED_TYPES.has(file.type.toLowerCase())) {
    return "Choose a JPEG, PNG, or WebP photo.";
  }

  return null;
}

function getScaledDimensions(width: number, height: number) {
  const scale = Math.min(1, MAX_PHOTO_SIDE / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function canvasToJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("This photo could not be processed. Please choose another image."));
      }
    }, "image/jpeg", 0.85);
  });
}

async function encodeBitmap(bitmap: ImageBitmap): Promise<File> {
  const { width, height } = getScaledDimensions(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("This photo could not be processed. Please choose another image.");
  }

  let blob: Blob;
  try {
    context.drawImage(bitmap, 0, 0, width, height);
    blob = await canvasToJpeg(canvas);
  } finally {
    bitmap.close();
  }
  if (blob.size > MAX_PATIENT_PHOTO_SIZE) {
    throw new Error("Photo is too large after processing. Please choose another image.");
  }

  return new File([blob], "patient-photo.jpg", { type: "image/jpeg" });
}

async function encodeWithImageElement(file: File): Promise<File> {
  const sourceUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    const loaded = new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("This photo could not be processed. Please choose another image."));
    });
    image.src = sourceUrl;
    await loaded;
    const { width, height } = getScaledDimensions(image.naturalWidth, image.naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("This photo could not be processed. Please choose another image.");
    }

    context.drawImage(image, 0, 0, width, height);
    const blob = await canvasToJpeg(canvas);
    if (blob.size > MAX_PATIENT_PHOTO_SIZE) {
      throw new Error("Photo is too large after processing. Please choose another image.");
    }
    return new File([blob], "patient-photo.jpg", { type: "image/jpeg" });
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

export async function preparePatientPhoto(file: File): Promise<File> {
  const validationError = validatePatientPhoto(file);
  if (validationError) {
    throw new Error(validationError);
  }

  if (file.size <= RESIZE_THRESHOLD) {
    return file;
  }

  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file);
    return encodeBitmap(bitmap);
  }

  return encodeWithImageElement(file);
}

export function getVideoCaptureCrop(
  videoWidth: number,
  videoHeight: number,
  displayWidth: number,
  displayHeight: number
) {
  const displayAspectRatio = displayWidth / displayHeight;
  const videoAspectRatio = videoWidth / videoHeight;
  if (videoAspectRatio > displayAspectRatio) {
    const width = videoHeight * displayAspectRatio;
    return { x: (videoWidth - width) / 2, y: 0, width, height: videoHeight };
  }
  const height = videoWidth / displayAspectRatio;
  return { x: 0, y: (videoHeight - height) / 2, width: videoWidth, height };
}

export async function createPatientPhotoFromVideo(video: HTMLVideoElement, mirror = false): Promise<File> {
  const bounds = video.getBoundingClientRect();
  const displayWidth = bounds.width || video.videoWidth;
  const displayHeight = bounds.height || video.videoHeight;
  const crop = getVideoCaptureCrop(video.videoWidth, video.videoHeight, displayWidth, displayHeight);
  const scale = Math.min(1, MAX_PHOTO_SIDE / Math.max(crop.width, crop.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(crop.width * scale));
  canvas.height = Math.max(1, Math.round(crop.height * scale));
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Unable to capture this photo. Please try again.");
  }

  if (mirror) {
    context.translate(canvas.width, 0);
    context.scale(-1, 1);
  }
  context.drawImage(
    video,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    canvas.width,
    canvas.height
  );
  const blob = await canvasToJpeg(canvas);
  if (blob.size > MAX_PATIENT_PHOTO_SIZE) {
    throw new Error("Photo is too large. Please retake it.");
  }

  return new File([blob], "patient-photo.jpg", { type: "image/jpeg" });
}
