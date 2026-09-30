import bcrypt from "bcrypt";
import { IsNull } from "typeorm";
import { AppDataSource } from "../../database/data-source";
import { User } from "../../database/entities/User";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../../lib/jwt";
import { CustomAppError } from "../../lib/errors/customAppError";
import { ErrorCodes } from "../../lib/errors/errorCodes";
import { LoginDTO, RefreshDTO } from "@/types/auth.type";
import { writeAuditLog } from "@/lib/audit/writeAuditLog";
import { AuditAction, AuditEntityType } from "@/lib/audit/auditActions";

export class AuthService {
  private static async repo() {
    const db = await AppDataSource();
    return db.getRepository(User);
  }

  static async login(data: LoginDTO, requestMeta?: { ipAddress?: string; userAgent?: string }) {
    const repo = await this.repo();

    if (!data.phone) throw new CustomAppError( "Phone number is required", 401, ErrorCodes.VALIDATION_FAILED.code, ErrorCodes.VALIDATION_FAILED.label, "unauthorized" );
    if (!data.password) throw new CustomAppError( "Password is required", 401, ErrorCodes.VALIDATION_FAILED.code, ErrorCodes.VALIDATION_FAILED.label, "unauthorized" );

    const user = await repo.findOne({ where: { phone: data.phone, isDeleted: false } });

    if (!user) {
      // No user row yet to attach this to as entityId — logged with the
      // attempted phone in metadata instead so failed-login patterns
      // (e.g. someone hammering a phone number that doesn't exist) are
      // still visible to whoever reviews the audit log.
      await writeAuditLog({
        action: AuditAction.LOGIN_FAILED,
        entityType: AuditEntityType.USER,
        metadata: { phone: data.phone, reason: "no_such_account" },
        ipAddress: requestMeta?.ipAddress,
        userAgent: requestMeta?.userAgent,
      });
      throw new CustomAppError( "Invalid phone number or password", 401, ErrorCodes.INVALID_CREDENTIALS.code, ErrorCodes.INVALID_CREDENTIALS.label, "unauthorized" );
    }

    if (!user.isActive) {
      await writeAuditLog({
        action: AuditAction.LOGIN_FAILED,
        entityType: AuditEntityType.USER,
        entityId: user.id,
        metadata: { reason: "account_inactive" },
        ipAddress: requestMeta?.ipAddress,
        userAgent: requestMeta?.userAgent,
      });
      throw new CustomAppError( "This account is deactivated. You may contact support for help!", 403, ErrorCodes.ACCOUNT_INACTIVE.code, ErrorCodes.ACCOUNT_INACTIVE.label, "forbidden" );
    }

    const passwordMatches = await bcrypt.compare(data.password, user.passwordHash);

    if (!passwordMatches) {
      await writeAuditLog({
        action: AuditAction.LOGIN_FAILED,
        entityType: AuditEntityType.USER,
        entityId: user.id,
        metadata: { reason: "bad_password" },
        ipAddress: requestMeta?.ipAddress,
        userAgent: requestMeta?.userAgent,
      });
      throw new CustomAppError( "Invalid phone number or password", 401, ErrorCodes.INVALID_CREDENTIALS.code, ErrorCodes.INVALID_CREDENTIALS.label, "unauthorized" );
    }

    await writeAuditLog({
      actorUserId: user.id,
      action: AuditAction.LOGIN_SUCCESS,
      entityType: AuditEntityType.USER,
      entityId: user.id,
      ipAddress: requestMeta?.ipAddress,
      userAgent: requestMeta?.userAgent,
    });

    const accessToken = signAccessToken(user.id, user.role);
    const refreshToken = signRefreshToken(user.id);

    return {
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
      },
      accessToken,
      refreshToken,
    };
  }

  // Exchanges a valid refresh token for a new access token AND a new
  // refresh token (rotation, so an active session slides forward and a
  // leaked token has a bounded life). The user is re-loaded every time,
  // so a deactivated/deleted user stops being able to refresh immediately
  // instead of staying signed in for the refresh token's full 30 days.
  // Limitation: refresh tokens are stateless, so an old one stays valid
  // until it expires; true revocation would need a server-side token store.
  static async refresh(data: RefreshDTO) {
    if (!data.refreshToken) {
      throw new CustomAppError("Refresh token is required", 401, ErrorCodes.INVALID_TOKEN.code, ErrorCodes.INVALID_TOKEN.label, "unauthorized");
    }

    let userId: string;
    try {
      userId = verifyRefreshToken(data.refreshToken).sub;
    } catch {
      throw new CustomAppError("Invalid or expired refresh token", 401, ErrorCodes.INVALID_TOKEN.code, ErrorCodes.INVALID_TOKEN.label, "unauthorized");
    }

    const repo = await this.repo();
    const user = await repo.findOne({ where: { id: userId, isDeleted: false } });

    if (!user || !user.isActive) {
      throw new CustomAppError("This session is no longer valid", 401, ErrorCodes.UNAUTHORIZED_ACCESS.code, ErrorCodes.UNAUTHORIZED_ACCESS.label, "unauthorized");
    }

    return {
      accessToken: signAccessToken(user.id, user.role),
      refreshToken: signRefreshToken(user.id),
    };
  }

  // Audit-only: JWTs are stateless, so this does NOT invalidate any token.
  // The client must discard its tokens; this just records who signed out.
  static async logout(userId: string, requestMeta?: { ipAddress?: string; userAgent?: string }) {
    await writeAuditLog({
      actorUserId: userId,
      action: AuditAction.LOGOUT,
      entityType: AuditEntityType.USER,
      entityId: userId,
      ipAddress: requestMeta?.ipAddress,
      userAgent: requestMeta?.userAgent,
    });
  }
}
