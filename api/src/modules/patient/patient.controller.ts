import { PatientService } from "./patient.service";
import type { CreatePatientDTO, UpdatePatientDTO, FilterPatientDTO } from "@/types/patient.type";
import type { PaginationQuery } from "@/types/pagination.type";
import type { ImageFileInput } from "@/lib/storage/createWithImages";

export class PatientController {
  static async getPatients(data: FilterPatientDTO & PaginationQuery) {
    return await PatientService.getPatients(data);
  }

  static async getPatient(id: string) {
    return await PatientService.getPatient(id);
  }

static async createPatient(data: CreatePatientDTO, actorUserId: string, image?: ImageFileInput) {
  return await PatientService.create(data, actorUserId, image);
}

static async updatePatient(id: string, data: UpdatePatientDTO, actorUserId?: string, image?: ImageFileInput) {
  return await PatientService.update(id, data, actorUserId, image);
}
  
  static async deletePatients(ids: string[], actorUserId?: string) {
    return await PatientService.delete(ids, actorUserId);
  }

}