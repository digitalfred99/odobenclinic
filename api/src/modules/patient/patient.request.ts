import { extractField } from "@/lib/http/parseFormData";
import type { ImageFileInput } from "@/lib/storage/createWithImages";
import { CustomAppError } from "@/lib/errors/customAppError";
import { ErrorCodes } from "@/lib/errors/errorCodes";
import type { CreatePatientManualDTO, UpdatePatientDTO } from "@/types/patient.type";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
// 5 MB image + room for the text fields.
const MAX_REQUEST_BYTES = 6 * 1024 * 1024;

const STRING_FIELDS = [
  "firstName", "lastName", "otherName", "phone", "dateOfBirth",
  "region", "district", "town", "area",
  "gender", "maritalStatus", "ghCardNumber", "nhisNumber",
  "confirmedDuplicatePatientId",
] as const;

const badRequest = (message: string, key: string, status = 400) =>
  new CustomAppError(message, status, ErrorCodes.VALIDATION_FAILED.code, ErrorCodes.VALIDATION_FAILED.label, key);

// Sniff the real format from the first bytes — never trust file.type / file.name.
function detectImageExt(buf: Buffer): "jpg" | "png" | "webp" | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (
    buf.length >= 8 &&
    buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) return "png";
  if (
    buf.length >= 12 &&
    buf.subarray(0, 4).toString("ascii") === "RIFF" &&
    buf.subarray(8, 12).toString("ascii") === "WEBP"
  ) return "webp";
  return null;
}

/** Safe replacement for req.formData(): early size check + 400 on a broken body. */
export async function readFormData(req: Request): Promise<FormData> {
  const contentLength = Number(req.headers.get("content-length") ?? 0);
  if (contentLength > MAX_REQUEST_BYTES) {
    throw badRequest("Image must be 5 MB or smaller", "image_too_large", 413);
  }
  try {
    return await req.formData();
  } catch {
    throw badRequest("Invalid or incomplete upload", "invalid_form_data");
  }
}

/** Reads the optional `image` part. Returns undefined if none was sent. */
export async function extractPatientImage(formData: FormData): Promise<ImageFileInput | undefined> {
  const file = formData.get("image");
  if (!file || !(file instanceof File)) return undefined;

  // Check size BEFORE buffering the whole file into memory.
  if (file.size === 0) throw badRequest("The uploaded image is empty", "image_empty");
  if (file.size > MAX_IMAGE_BYTES) {
    throw badRequest("Image must be 5 MB or smaller", "image_too_large", 413);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = detectImageExt(buffer);
  if (!ext) throw badRequest("Image must be a JPEG, PNG or WebP file", "image_invalid_type");

  return { fieldName: "imageUrl", buffer, originalName: `patient-photo.${ext}` };
}

// FormData is all strings: skip blanks, and coerce age, year and positionInYear back to numbers.
function readPatientFields(formData: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of STRING_FIELDS) {
    const value = extractField(formData, key);
    if (value !== undefined) out[key] = value;
  }
  for (const key of ["age", "year", "positionInYear"] as const) {
    const raw = extractField(formData, key);
    if (raw === undefined) continue;
    const num = Number(raw);
    if (!Number.isFinite(num)) throw badRequest(`${key} must be a valid number`, `invalid_${key}`);
    out[key] = num;
  }
  return out;
}

export const isMultipart = (req: Request) =>
  (req.headers.get("content-type") ?? "").includes("multipart/form-data");

export async function parseCreatePatientRequest(req: Request) {
  if (!isMultipart(req)) {
    // Backward compatible: plain JSON still works (no image).
    return { data: (await req.json()) as CreatePatientManualDTO, image: undefined };
  }
  const formData = await readFormData(req);
  return {
    data: readPatientFields(formData) as CreatePatientManualDTO,
    image: await extractPatientImage(formData),
  };
}

export async function parseUpdatePatientRequest(req: Request) {
  if (!isMultipart(req)) {
    return { data: (await req.json()) as UpdatePatientDTO, image: undefined };
  }
  const formData = await readFormData(req);
  return {
    data: readPatientFields(formData) as UpdatePatientDTO, // only fields actually sent
    image: await extractPatientImage(formData),
  };
}