import { DashboardService } from "./dashboard.service";

export class DashboardController {
  static async getReceptionistOverview() {
    return await DashboardService.receptionistOverview();
  }
}
