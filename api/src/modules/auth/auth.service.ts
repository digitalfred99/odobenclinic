import bcrypt from "bcrypt";
import { AppDataSource } from "../../database/data-source";
import { User } from "../../database/entities/User";
import { signAccessToken, signRefreshToken, verifyRefreshToken, type RefreshTokenPayload } from "../../lib/jwt";
import { CustomAppError } from "../../lib/errors/customAppError";
import { ErrorCodes } from "../../lib/errors/errorCodes";
import { ChangePasswordDTO, LoginDTO, RefreshDTO } from "@/types/auth.type";
import { writeAuditLog } from "@/lib/audit/writeAuditLog";
import { AuditAction, AuditEntityType } from "@/lib/audit/auditActions";
import { validateChangePassword } from "./auth.validator";

export class AuthService {
  private static async repo() {
    const db = await AppDataSource();
    return db.getRepository(User);
  }

  static async changePassword(
    userId: string,
    data: ChangePasswordDTO,
    requestMeta?: { ipAddress?: string; userAgent?: string }
  ) {
    validateChangePassword(data);

    const repo = await this.repo();
    const user = await repo.findOne({ where: { id: userId, isDeleted: false } });
    if (!user) {
      throw new CustomAppError("No user found with this provided ID", 404, ErrorCodes.USER_NOT_FOUND.code, ErrorCodes.USER_NOT_FOUND.label, "user_not_found");
    }

    if (!user.isActive) {
      throw new CustomAppError("This account is deactivated. You may contact support for help!", 403, ErrorCodes.ACCOUNT_INACTIVE.code, ErrorCodes.ACCOUNT_INACTIVE.label, "forbidden");
    }

    const valid = await bcrypt.compare(data.currentPassword, user.passwordHash);
    if (!valid) {
      await writeAuditLog({
        actorUserId: userId,
        action: AuditAction.PASSWORD_CHANGE_FAILED,
        entityType: AuditEntityType.USER,
        entityId: userId,
        metadata: { reason: "bad_current_password" },
        ipAddress: requestMeta?.ipAddress,
        userAgent: requestMeta?.userAgent,
      });
      throw new CustomAppError("Current password is incorrect", 401, ErrorCodes.INVALID_CREDENTIALS.code, ErrorCodes.INVALID_CREDENTIALS.label, "invalid_current_password");
    }

    const same = await bcrypt.compare(data.newPassword, user.passwordHash);
    if (same) {
      throw new CustomAppError("New password must be different from your current password", 400, ErrorCodes.INVALID_STATE.code, ErrorCodes.INVALID_STATE.label, "same_password");
    }

    const newHash = await bcrypt.hash(data.newPassword, 10);
    const newVersion = user.tokenVersion + 1;
    await repo.update(userId, { passwordHash: newHash, tokenVersion: newVersion });

    await writeAuditLog({
      actorUserId: userId,
      action: AuditAction.PASSWORD_CHANGED,
      entityType: AuditEntityType.USER,
      entityId: userId,
      ipAddress: requestMeta?.ipAddress,
      userAgent: requestMeta?.userAgent,
    });

    return { success: true };
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

    const accessToken = signAccessToken(user.id, user.role, user.tokenVersion);
    const refreshToken = signRefreshToken(user.id, user.tokenVersion);

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
  // Tokens are rejected when the user's tokenVersion no longer matches
  // (bumped on password change). Otherwise they stay valid until expiry.
  static async refresh(data: RefreshDTO) {
    if (!data.refreshToken) {
      throw new CustomAppError("Refresh token is required", 401, ErrorCodes.INVALID_TOKEN.code, ErrorCodes.INVALID_TOKEN.label, "unauthorized");
    }

    let payload: RefreshTokenPayload;
    try {
      payload = verifyRefreshToken(data.refreshToken);
    } catch {
      throw new CustomAppError("Invalid or expired refresh token", 401, ErrorCodes.INVALID_TOKEN.code, ErrorCodes.INVALID_TOKEN.label, "unauthorized");
    }

    const repo = await this.repo();
    const user = await repo.findOne({ where: { id: payload.sub, isDeleted: false } });

    if (!user || !user.isActive || (payload.tv ?? 0) !== user.tokenVersion) {
      throw new CustomAppError("This session is no longer valid", 401, ErrorCodes.UNAUTHORIZED_ACCESS.code, ErrorCodes.UNAUTHORIZED_ACCESS.label, "unauthorized");
    }

    return {
      accessToken: signAccessToken(user.id, user.role, user.tokenVersion),
      refreshToken: signRefreshToken(user.id, user.tokenVersion),
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
