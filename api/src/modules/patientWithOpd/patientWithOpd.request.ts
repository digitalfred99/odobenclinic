import { CustomAppError } from "@/lib/errors/customAppError";
import { ErrorCodes } from "@/lib/errors/errorCodes";
import type { ImageFileInput } from "@/lib/storage/createWithImages";
import type { CreatePatientWithOpdDTO } from "@/types/patientWithOpd.type";
import {
  extractPatientImage,
  isMultipart,
  readFormData,
} from "@/modules/patient/patient.request";

const badRequest = (message: string, key: string) =>
  new CustomAppError(message, 400, ErrorCodes.VALIDATION_FAILED.code, ErrorCodes.VALIDATION_FAILED.label, key);

function parseJsonField(value: FormDataEntryValue | null, name: string): unknown {
  if (value === null || value === "") return undefined;
  if (typeof value !== "string") throw badRequest(`${name} must be a JSON text field`, "bad_request");
  try {
    return JSON.parse(value);
  } catch {
    throw badRequest(`${name} is not valid JSON`, "bad_request");
  }
}

/**
 * Accepts either:
 *  - application/json:    { patient, opdVisit? }                      (no photo)
 *  - multipart/form-data: patient (JSON text), opdVisit (JSON text, optional), image (file, optional)
 */
export async function parseCreatePatientWithOpdRequest(
  req: Request
): Promise<{ data: CreatePatientWithOpdDTO; image?: ImageFileInput }> {
  if (!isMultipart(req)) {
    return { data: (await req.json()) as CreatePatientWithOpdDTO, image: undefined };
  }

  const formData = await readFormData(req);

  return {
    data: {
      patient: parseJsonField(formData.get("patient"), "patient"),
      opdVisit: parseJsonField(formData.get("opdVisit"), "opdVisit"),
    } as CreatePatientWithOpdDTO,
    image: await extractPatientImage(formData),
  };
}