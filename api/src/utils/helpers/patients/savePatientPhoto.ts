import { CustomAppError } from "@/lib/errors/customAppError";
import { ErrorCodes } from "@/lib/errors/errorCodes";
import { createWithImages, AVATAR_COMPRESSION, ImageProcessingError, type ImageFileInput, } from "@/lib/storage/createWithImages";

const PATIENT_PHOTO_COMPRESSION = AVATAR_COMPRESSION;

export async function savePatientPhoto<T>(
  image: ImageFileInput,
  persist: (imageUrl: string) => Promise<T>
): Promise<T> {
  try {
    return await createWithImages(
      { ...image, fieldName: "imageUrl", },
      (urls) => persist(urls.imageUrl),
      { folder: "patients" }
    );
  } catch (err) {
    // Bad, empty, too large or unsupported image: return 400, not 500.
    if (err instanceof ImageProcessingError) {
      throw new CustomAppError( err.message, 400, ErrorCodes.VALIDATION_FAILED.code, ErrorCodes.VALIDATION_FAILED.label, `image_${err.code.toLowerCase()}` );
    }
    throw err;
  }
}