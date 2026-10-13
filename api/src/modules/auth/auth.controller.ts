import { AuthService } from "@/modules/auth/auth.service";
import type { ChangePasswordDTO, LoginDTO, RefreshDTO } from "@/types/auth.type";

type RequestMeta = { ipAddress?: string; userAgent?: string };

export class AuthController {
  static async changePassword(userId: string, data: ChangePasswordDTO, requestMeta?: RequestMeta) {
    return await AuthService.changePassword(userId, data, requestMeta);
  }

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
