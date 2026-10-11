import { PatientWithOpdService } from "./patientWithOpd.service";
import type { CreatePatientWithOpdDTO } from "@/types/patientWithOpd.type";

export class PatientWithOpdController {
    static async createPatientWithOpd(data: CreatePatientWithOpdDTO, actorUserId: string) {
    return await PatientWithOpdService.createPatientWithOpd(data, actorUserId);
    }
}