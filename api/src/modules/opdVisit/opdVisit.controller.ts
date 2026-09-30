import { OPDVisitService } from "./opdVisit.service";
import type { CreateOPDVisitDTO, UpdateOPDVisitDTO, FilterOPDVisitDTO } from "@/types/opdVisit.type";
import type { PaginationQuery } from "@/types/pagination.type";

export class OPDVisitController {
  static async getOPDVisits(data: FilterOPDVisitDTO & PaginationQuery) {
    return await OPDVisitService.getOPDVisits(data);
  }

  static async getOPDVisit(id: string) {
    return await OPDVisitService.getOPDVisit(id);
  }

  static async createOPDVisit(data: CreateOPDVisitDTO, createdById: string) {
    return await OPDVisitService.create(data, createdById);
  }

  static async updateOPDVisit(id: string, data: UpdateOPDVisitDTO, actorUserId?: string) {
    return await OPDVisitService.update(id, data, actorUserId)
  }
  
  static async deleteOPDVisits(ids: string[], actorUserId?: string) {
    return await OPDVisitService.delete(ids, actorUserId);
  }
}