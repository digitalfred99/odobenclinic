import { PatientService } from "./patient.service";
import type { UpdatePatientDTO, FilterPatientDTO, CreatePatientManualDTO } from "@/types/patient.type";
import type { PaginationQuery } from "@/types/pagination.type";
import type { ImageFileInput } from "@/lib/storage/createWithImages";
import { resolveImageUrl } from "@/lib/storage/imageUrl";

// Database holds the image key; the API returns a full, loadable URL.
const withImage = <T extends { imageUrl?: string | null }>(p: T): T => ({
  ...p,
  imageUrl: resolveImageUrl(p.imageUrl) ?? undefined,
});

export class PatientController {
  static async getPatients(data: FilterPatientDTO & PaginationQuery) {
    const result = await PatientService.getPatients(data);
    return { ...result, patients: result.patients.map(withImage) };
  }

  static async getPatient(id: string) {
    return withImage(await PatientService.getPatient(id));
  }

  static async createPatient(data: CreatePatientManualDTO, actorUserId: string, image?: ImageFileInput) {
    return withImage(await PatientService.create(data, actorUserId, image));
  }

  static async updatePatient(id: string, data: UpdatePatientDTO, actorUserId?: string, image?: ImageFileInput) {
    return withImage(await PatientService.update(id, data, actorUserId, image));
  }

  static async deletePatients(ids: string[], actorUserId?: string) {
    return await PatientService.delete(ids, actorUserId);
  }
}