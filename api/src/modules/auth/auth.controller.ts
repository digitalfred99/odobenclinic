import { AuthService } from "@/modules/auth/auth.service";
import type { LoginDTO, RefreshDTO } from "@/types/auth.type";

type RequestMeta = { ipAddress?: string; userAgent?: string };

export class AuthController {
  static async login(data: LoginDTO, requestMeta?: RequestMeta) {
    return await AuthService.login(data, requestMeta);
  }

  static async refresh(data: RefreshDTO) {
    return await AuthService.refresh(data);
  }

  static async logout(userId: string, requestMeta?: RequestMeta) {
    return await AuthService.logout(userId, requestMeta);
  }
}
