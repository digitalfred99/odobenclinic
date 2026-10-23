// src/lib/storage/createWithImages.ts
import path from "path";
import sharp, { type Metadata } from "sharp";
import { getStorageAdapter } from "./getStorageAdapter";

/* ---------- Types ---------- */

export type OutputFormat = "original" | "webp" | "jpeg" | "png";

export interface ImageCompressionOptions {
  /** Resize only if larger. Aspect ratio kept, never enlarges. */
  maxWidth?: number;
  maxHeight?: number;
  /** Default "original" */
  format?: OutputFormat;
  /** 1-100, jpeg/webp only. Default 80 */
  quality?: number;
  /** Lowest quality tried when chasing targetBytes. Default 50 */
  minQuality?: number;
  /** Goal for output size in bytes. Not guaranteed. */
  targetBytes?: number;
  /** What to do if targetBytes can't be met at minQuality. Default "accept" */
  onTargetMissed?: "accept" | "reject";
}

export interface ImageFileInput {
  fieldName: string; // e.g. "profileImage", "coverImage"
  buffer: Buffer;
  originalName: string;
  /** Omit to only validate the image (no resize or re-encode unless it needs rotating). */
  compress?: ImageCompressionOptions;
}

export type ImageErrorCode =
  | "FILE_TOO_LARGE"
  | "EMPTY_FILE"
  | "INVALID_IMAGE"
  | "UNSUPPORTED_FORMAT"
  | "TARGET_NOT_MET";

export class ImageProcessingError extends Error {
  constructor(public readonly code: ImageErrorCode, message: string) {
    super(message);
    this.name = "ImageProcessingError";
  }
}

/* ---------- Presets (opt-in, never applied automatically) ---------- */

/** Small square-ish profile picture: 600px max, WebP, ~100 KB goal. */
export const AVATAR_COMPRESSION: ImageCompressionOptions = {
  maxWidth: 600,
  maxHeight: 600,
  format: "webp",
  quality: 82,
  minQuality: 60, // keeps detail such as faces clear
  targetBytes: 100 * 1024,
};

/* ---------- Processing ---------- */

const DEFAULT_MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_INPUT_PIXELS = 40_000_000; // guards against decompression bombs
const SUPPORTED_FORMATS = ["jpeg", "png", "webp", "gif"];
const FORMAT_EXTENSION: Record<string, string> = {
  jpeg: ".jpg",
  png: ".png",
  webp: ".webp",
  gif: ".gif",
};

// Limits simultaneous sharp jobs across requests (memory/CPU protection).
const MAX_CONCURRENT_IMAGE_JOBS = 2;
let activeJobs = 0;
const queue: Array<() => void> = [];

async function withConcurrencyLimit<T>(fn: () => Promise<T>): Promise<T> {
  if (activeJobs < MAX_CONCURRENT_IMAGE_JOBS) activeJobs++;
  else await new Promise<void>((resolve) => queue.push(resolve)); // slot handed over
  try {
    return await fn();
  } finally {
    const next = queue.shift();
    if (next) next();
    else activeJobs--;
  }
}

function replaceExtension(name: string, ext: string): string {
  const parsed = path.parse(name);
  return `${parsed.name || "image"}${ext}`;
}

export interface ProcessedImage {
  buffer: Buffer;
  /** File name matching the final format (extension updated if format changed). */
  fileName: string;
  format: string;
  width?: number;
  height?: number;
  /** false when the input was returned untouched */
  changed: boolean;
  targetMet: boolean;
}

export async function processImage(
  input: { buffer: Buffer; originalName: string },
  opts: ImageCompressionOptions
): Promise<ProcessedImage> {
  const o = {
    format: "original" as OutputFormat,
    quality: 80,
    minQuality: 50,
    onTargetMissed: "accept" as const,
    ...opts,
  };
  const open = () =>
    sharp(input.buffer, { failOn: "error", limitInputPixels: MAX_INPUT_PIXELS });

  let meta: Metadata;
  try {
    meta = await open().metadata();
  } catch {
    throw new ImageProcessingError("INVALID_IMAGE", "File is not a valid image.");
  }
  const inFormat = meta.format;
  if (!inFormat || !SUPPORTED_FORMATS.includes(inFormat) || !meta.width || !meta.height) {
    throw new ImageProcessingError(
      "UNSUPPORTED_FORMAT",
      `Unsupported image format: ${inFormat ?? "unknown"}.`
    );
  }

  const isTargetMet = (size: number) => o.targetBytes === undefined || size <= o.targetBytes;
  const passthrough = (): ProcessedImage => ({
    buffer: input.buffer,
    // Extension comes from the detected format, never from the client's file name.
    fileName: replaceExtension(input.originalName, FORMAT_EXTENSION[inFormat]),
    format: inFormat,
    width: meta.width,
    height: meta.height,
    changed: false,
    targetMet: isTargetMet(input.buffer.length),
  });

  // Animated images: leave untouched rather than flatten them to one frame.
  if ((meta.pages ?? 1) > 1) return passthrough();

  const orientation = meta.orientation ?? 1;
  const swapped = orientation >= 5;
  const width = swapped ? meta.height : meta.width;
  const height = swapped ? meta.width : meta.height;

  const needsResize =
    (o.maxWidth !== undefined && width > o.maxWidth) ||
    (o.maxHeight !== undefined && height > o.maxHeight);
  const needsRotate = orientation !== 1;
  const outFormat = o.format === "original" ? inFormat : o.format;
  const overTarget = o.targetBytes !== undefined && input.buffer.length > o.targetBytes;

  // Already small, correctly oriented, same format: don't re-encode.
  if (!needsResize && !needsRotate && outFormat === inFormat && !overTarget) {
    return passthrough();
  }

  const encode = (quality: number): Promise<Buffer> => {
    let pipeline = open().rotate(); // auto-orient and strip EXIF orientation
    if (needsResize) {
      pipeline = pipeline.resize({
        width: o.maxWidth,
        height: o.maxHeight,
        fit: "inside",
        withoutEnlargement: true,
      });
    }
    switch (outFormat) {
      case "jpeg":
        return pipeline.flatten({ background: "#ffffff" }).jpeg({ quality, mozjpeg: true }).toBuffer();
      case "webp":
        return pipeline.webp({ quality }).toBuffer();
      case "png":
        return pipeline.png({ compressionLevel: 9 }).toBuffer();
      default:
        return pipeline.gif().toBuffer();
    }
  };

  try {
    const isLossy = outFormat === "jpeg" || outFormat === "webp";
    let quality = o.quality;
    let output = await encode(quality);

    if (isLossy && o.targetBytes !== undefined) {
      while (output.length > o.targetBytes && quality > o.minQuality) {
        quality = Math.max(o.minQuality, quality - 10);
        output = await encode(quality);
      }
    }

    const targetMet = isTargetMet(output.length);
    if (!targetMet && o.onTargetMissed === "reject") {
      throw new ImageProcessingError(
        "TARGET_NOT_MET",
        `Could not reach ${o.targetBytes} bytes at quality ${o.minQuality} (got ${output.length}).`
      );
    }

    // Never return something bigger when nothing else required the change.
    if (!needsResize && !needsRotate && outFormat === inFormat && output.length >= input.buffer.length) {
      return passthrough();
    }

    const outMeta = await sharp(output).metadata();
    return {
      buffer: output,
      fileName: replaceExtension(input.originalName, FORMAT_EXTENSION[outFormat]),
      format: outFormat,
      width: outMeta.width,
      height: outMeta.height,
      changed: true,
      targetMet,
    };
  } catch (err) {
    if (err instanceof ImageProcessingError) throw err;
    throw new ImageProcessingError("INVALID_IMAGE", "Image could not be processed.");
  }
}

/* ---------- Upload + persist ---------- */

/**
 * Validates and (optionally) compresses images, uploads them, then runs
 * `persist` with a map of fieldName -> storedUrl. If `persist` or any upload
 * throws, every image uploaded in this call is deleted again.
 */
export async function createWithImages<T>(
  images: ImageFileInput | ImageFileInput[],
  persist: (urls: Record<string, string>) => Promise<T>,
  options?: { folder?: string; maxUploadBytes?: number }
): Promise<T> {
  const storage = getStorageAdapter();
  const list = Array.isArray(images) ? images : [images];
  const maxBytes = options?.maxUploadBytes ?? DEFAULT_MAX_UPLOAD_BYTES;

  // 1. Server-side validation + processing BEFORE any upload happens.
  const prepared: { fieldName: string; buffer: Buffer; fileName: string }[] = [];
  for (const img of list) {
    if (img.buffer.length === 0) {
      throw new ImageProcessingError("EMPTY_FILE", `${img.fieldName}: file is empty.`);
    }
    if (img.buffer.length > maxBytes) {
      throw new ImageProcessingError("FILE_TOO_LARGE", `${img.fieldName}: exceeds ${maxBytes} bytes.`);
    }
    // Always validate with sharp, even without compression options.
    const compress = img.compress ?? {};
    const result = await withConcurrencyLimit(() => processImage(img, compress));
    if (!result.targetMet) {
      console.warn(`[images] ${img.fieldName}: target size not met (${result.buffer.length} bytes).`);
    }
    prepared.push({ fieldName: img.fieldName, buffer: result.buffer, fileName: result.fileName });
  }

  // 2. Upload, then persist; compensate on failure.
  const uploaded: { fieldName: string; url: string }[] = [];
  try {
    for (const img of prepared) {
      const url = await storage.upload(img.buffer, img.fileName, options?.folder);
      uploaded.push({ fieldName: img.fieldName, url });
    }
    const urlMap = Object.fromEntries(uploaded.map((u) => [u.fieldName, u.url]));
    return await persist(urlMap);
  } catch (err) {
    await Promise.allSettled(uploaded.map((u) => storage.delete(u.url)));
    throw err;
  }
}