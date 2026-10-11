import type { CreatePatientDTO } from "@/types/patient.type";
import type { CreateOPDVisitDTO } from "@/types/opdVisit.type";

export type CreatePatientWithOpdDTO = {
    patient: CreatePatientDTO;
    // Optional — if omitted, a visit is still created with today's date
    // and no remarks. The patient link is set by the service.
    opdVisit?: Omit<CreateOPDVisitDTO, "patient">;
};