import { PatientWithOpdService } from "./patientWithOpd.service";
import type { CreatePatientWithOpdDTO } from "@/types/patientWithOpd.type";
import type { ImageFileInput } from "@/lib/storage/createWithImages";

export class PatientWithOpdController {
  static async createPatientWithOpd( data: CreatePatientWithOpdDTO, actorUserId: string, image?: ImageFileInput ) {
    return await PatientWithOpdService.createPatientWithOpd(data, actorUserId, image);
  }
}