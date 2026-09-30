import { validateCreateUser, validatePasswordStrength, validateUserEnum } from "@/modules/user/user.validator";
import { validate as isUUID } from "uuid";
import { Brackets, In, EntityManager } from "typeorm";
import { AppDataSource } from "@/database/data-source";
import { User, UserRole } from "@/database/entities/User";
import { CreateUserDTO, FilterUserDTO, UpdateUserDTO, UserActor } from "@/types/user.type";
import { CustomAppError } from "@/lib/errors/customAppError";
import { ErrorCodes } from "@/lib/errors/errorCodes";
import bcrypt from "bcrypt";
import { UserSanitizer } from "./user.sanitizer";
import { buildPaginationMeta, parsePagination } from "@/lib/http/pagination";
import { PaginationQuery } from "@/types/pagination.type";

import { writeAuditLog } from "@/lib/audit/writeAuditLog";
import { AuditAction, AuditEntityType } from "@/lib/audit/auditActions";

const ADMIN_TIER_ROLES: ReadonlySet<UserRole> = new Set([UserRole.ADMIN, UserRole.SUPER_ADMIN]);

export class UserService {

  private static withoutPassword(user: User) {
    const { passwordHash: _password, ...safeUser } = user;
    return safeUser;
  }

  private static async repo() {
    const db = await AppDataSource();
    return db.getRepository(User);
  }

  // The core authority rule for this whole module:
  //   - Acting on your own account is always allowed (no separate "me"
  //     endpoint exists, so self-service name/phone/password edits go
  //     through this same path).
  //   - SUPER_ADMIN can manage anyone.
  //   - ADMIN can manage RECEPTIONIST accounts (this is the "clinic-level
  //     administrator manages clinic users" rule from the spec), but NOT
  //     other ADMIN or SUPER_ADMIN accounts, and NOT other admins' peers.
  //   - RECEPTIONIST cannot manage any other user's account at all —
  //     including another receptionist's. The previous version of this
  //     check only blocked acting on ADMIN_TIER targets, which left a
  //     gap: a plain receptionist could edit (or delete) any *other*
  //     receptionist's phone/email/password, since RECEPTIONIST targets
  //     fell through with no check at all.
  private static assertCanManageTarget(actor: UserActor, target: User) {
    if (actor.id === target.id) return;
    if (actor.role === UserRole.SUPER_ADMIN) return;

    if (actor.role === UserRole.ADMIN && target.role === UserRole.RECEPTIONIST) return;

    throw new CustomAppError(
      "You do not have permission to manage this user account",
      403,
      ErrorCodes.PERMISSION_DENIED.code,
      ErrorCodes.PERMISSION_DENIED.label,
      "forbidden"
    );
  }

  static async getUsers(filters: FilterUserDTO & PaginationQuery) {
      const repo = await this.repo();
      const usersQuery = repo
        .createQueryBuilder("user")
        .where("user.isDeleted = :isDeleted", { isDeleted: false })
        .andWhere("user.role != :superAdminRole", {
          superAdminRole: UserRole.SUPER_ADMIN,
        });

      if (filters.role) {
        usersQuery.andWhere("user.role = :role", { role: filters.role as UserRole });
      }
      if (filters.isActive !== undefined) {
        usersQuery.andWhere("user.isActive = :isActive", {
          isActive: filters.isActive,
        });
      }

      const searchTerms = filters.search?.trim().split(/\s+/).filter(Boolean) ?? [];
      searchTerms.forEach((term, index) => {
        const parameter = `searchTerm${index}`;
        const pattern = `%${term}%`;

        usersQuery.andWhere(
          new Brackets((searchQuery) => {
            searchQuery
              .where(`user.firstName ILIKE :${parameter}`, { [parameter]: pattern })
              .orWhere(`user.lastName ILIKE :${parameter}`, { [parameter]: pattern })
              .orWhere(`user.phone ILIKE :${parameter}`, { [parameter]: pattern });
          })
        );
      });

      const { page, limit, skip, take } = parsePagination({
        page: filters.page?.toString(),
        limit: filters.limit?.toString(),
      });

      const [users, count] = await usersQuery
        .orderBy("user.createdAt", "DESC")
        .skip(skip)
        .take(take)
        .getManyAndCount();

      return { users: users.map(this.withoutPassword), pagination: buildPaginationMeta(count, page, limit) };
  }

  // GET is intentionally not locked to admin-tier-only — self-access must
  // keep working (no separate "me" endpoint exists). Viewing another
  // admin/super_admin's basic record is allowed for any admin-tier actor;
  // view was deliberately not treated as the sensitive boundary here —
  // write access is (see assertCanManageTarget).
  static async getUser(id: string, actor: UserActor) {
    if (!id || !isUUID(id)) {
      throw new CustomAppError("Valid User ID is required", 400, ErrorCodes.ID_REQUIRED.code, ErrorCodes.ID_REQUIRED.label, "bad_request");
    }

    const repo = await this.repo();

    const user = await repo.findOne({
      where: { id, isDeleted: false },
    });

    if (!user) {
      throw new CustomAppError("No user found with the given ID", 404, ErrorCodes.USER_NOT_FOUND.code, ErrorCodes.USER_NOT_FOUND.label, "user_not_found");
    }

    if (actor.id !== user.id && !ADMIN_TIER_ROLES.has(actor.role)) {
      throw new CustomAppError(
        "You do not have permission to view this user",
        403,
        ErrorCodes.PERMISSION_DENIED.code,
        ErrorCodes.PERMISSION_DENIED.label,
        "forbidden"
      );
    }

    return this.withoutPassword(user);
  }

  static async create(data: CreateUserDTO, actor: UserActor) {
      const db = await AppDataSource();
      const repo = db.getRepository(User);

      const safeData = UserSanitizer.create(data);

      validateCreateUser(safeData); // now internally covers presence + enum + password strength

      // Only a super admin may mint a new admin or super_admin account
      // through this endpoint — a regular admin creating accounts is
      // limited to RECEPTIONIST, matching assertCanManageTarget's rule
      // that ADMIN only manages RECEPTIONIST accounts.
      if (ADMIN_TIER_ROLES.has(safeData.role) && actor.role !== UserRole.SUPER_ADMIN) {
        throw new CustomAppError(
          "Only a super admin can create an admin or super admin account",
          403,
          ErrorCodes.PERMISSION_DENIED.code,
          ErrorCodes.PERMISSION_DENIED.label,
          "forbidden"
        );
      }

      const existingUser = await repo.findOne({
        where: { phone: safeData.phone, isDeleted: false },
      });

      if (existingUser) {
        throw new CustomAppError("User with this phone already exists", 400, ErrorCodes.RECORD_ALREADY_EXISTS.code, ErrorCodes.RECORD_ALREADY_EXISTS.label, "user_exists");
      }

      const passwordHash = await bcrypt.hash(safeData.password, 10);

      return db.transaction(async (manager: EntityManager) => {
        const txRepo = manager.getRepository(User);

        const newUser = txRepo.create({
          firstName: safeData.firstName,
          lastName: safeData.lastName,
          phone: safeData.phone,
          email: safeData.email,
          role: safeData.role,
          passwordHash,
        });

        const savedUser = await txRepo.save(newUser);

        await writeAuditLog(
          {
            actorUserId: actor.id,
            action: AuditAction.USER_REGISTERED,
            entityType: AuditEntityType.USER,
            entityId: savedUser.id,
            metadata: { role: savedUser.role },
          },
          manager
        );

        return this.withoutPassword(savedUser);
      });
  }

  static async update(id: string, data: UpdateUserDTO, actor: UserActor) {
    if (!id || !isUUID(id)) {
      throw new CustomAppError("Valid User ID is required", 400, ErrorCodes.ID_REQUIRED.code, ErrorCodes.ID_REQUIRED.label, "bad_request");
    }

    const safeData = UserSanitizer.update(data);
    validateUserEnum(safeData);
    // A password change via PATCH must meet the same strength bar as one
    // set at account creation — the previous version only validated
    // enums on update, so a weak password slipped straight through here.
    if (safeData.password !== undefined) {
      validatePasswordStrength(safeData);
    }

    const db = await AppDataSource();

    return db.transaction(async (manager: EntityManager) => {
      const repo = manager.getRepository(User);

      const existingUser = await repo.findOne({ where: { id, isDeleted: false } });
      if (!existingUser) {
        throw new CustomAppError("No user found with the given ID", 404, ErrorCodes.USER_NOT_FOUND.code, ErrorCodes.USER_NOT_FOUND.label, "user_not_found");
      }

      this.assertCanManageTarget(actor, existingUser);

      if (safeData.phone && safeData.phone !== existingUser.phone) {
        const phoneTaken = await repo.findOne({ where: { phone: safeData.phone, isDeleted: false } });
        if (phoneTaken && phoneTaken.id !== existingUser.id) {
          throw new CustomAppError("Another user already has this phone number", 409, ErrorCodes.RECORD_ALREADY_EXISTS.code, ErrorCodes.RECORD_ALREADY_EXISTS.label, "user_exists");
        }
      }

      const { password, ...rest } = safeData;
      const patch: Partial<User> = { ...rest };
      if (password) {
        patch.passwordHash = await bcrypt.hash(password, 10);
      }

      const updatedUser = repo.merge(existingUser, patch);
      const savedUser = await repo.save(updatedUser);

      // Fine-grained audit trail for the fields that actually matter for
      // security/contact-ability, plus a general "something was edited"
      // record — using the existing per-field AuditAction constants
      // rather than inventing a new logging mechanism.
      if (password) {
        await writeAuditLog(
          { actorUserId: actor.id, action: AuditAction.PASSWORD_CHANGED, entityType: AuditEntityType.USER, entityId: savedUser.id },
          manager
        );
      }
      if (rest.phone && rest.phone !== existingUser.phone) {
        await writeAuditLog(
          { actorUserId: actor.id, action: AuditAction.PHONE_CHANGED, entityType: AuditEntityType.USER, entityId: savedUser.id },
          manager
        );
      }
      if (rest.email && rest.email !== existingUser.email) {
        await writeAuditLog(
          { actorUserId: actor.id, action: AuditAction.EMAIL_CHANGED, entityType: AuditEntityType.USER, entityId: savedUser.id },
          manager
        );
      }
      await writeAuditLog(
        {
          actorUserId: actor.id,
          action: AuditAction.USER_EDITED,
          entityType: AuditEntityType.USER,
          entityId: savedUser.id,
          metadata: { changedFields: Object.keys(safeData) },
        },
        manager
      );

      return this.withoutPassword(savedUser);
    });
  }

  // For admin-tier actors to deactivate a user without deleting them —
  // history (createdBy/audit references) stays intact, the account just
  // can no longer authenticate (see AuthService.login's isActive check).
  static async deactivateUser(userId: string, actor: UserActor) {
    if (!userId || !isUUID(userId)) {
      throw new CustomAppError("Valid user ID is required", 400, ErrorCodes.ID_REQUIRED.code, ErrorCodes.ID_REQUIRED.label, "bad_request");
    }

    const db = await AppDataSource();

    return db.transaction(async (manager: EntityManager) => {
      const repo = manager.getRepository(User);

      const user = await repo.findOne({ where: { id: userId, isDeleted: false, isActive: true } });
      if (!user) {
        throw new CustomAppError("No active user found to be deactivated with the given ID", 404, ErrorCodes.USER_NOT_FOUND.code, ErrorCodes.USER_NOT_FOUND.label, "user_not_found");
      }

      this.assertCanManageTarget(actor, user);

      if (user.role === UserRole.SUPER_ADMIN) {
        await this.assertSuperAdminsRemainActive(manager, [user.id]);
      }

      user.isActive = false;
      const savedUser = await repo.save(user);

      await writeAuditLog(
        {
          actorUserId: actor.id,
          action: AuditAction.USER_DEACTIVATED,
          entityType: AuditEntityType.USER,
          entityId: savedUser.id,
        },
        manager
      );

      return this.withoutPassword(savedUser);
    });
  }

  // Counterpart to deactivateUser — a deactivated account isn't gone,
  // so it should be straightforward to bring back without recreating it
  // (and losing its historical createdBy/audit trail in the process).
  static async activateUser(userId: string, actor: UserActor) {
    if (!userId || !isUUID(userId)) {
      throw new CustomAppError("Valid user ID is required", 400, ErrorCodes.ID_REQUIRED.code, ErrorCodes.ID_REQUIRED.label, "bad_request");
    }

    const db = await AppDataSource();

    return db.transaction(async (manager: EntityManager) => {
      const repo = manager.getRepository(User);

      const user = await repo.findOne({ where: { id: userId, isDeleted: false, isActive: false } });
      if (!user) {
        throw new CustomAppError("No inactive user found to be activated with the given ID", 404, ErrorCodes.USER_NOT_FOUND.code, ErrorCodes.USER_NOT_FOUND.label, "user_not_found");
      }

      this.assertCanManageTarget(actor, user);

      user.isActive = true;
      const savedUser = await repo.save(user);

      await writeAuditLog(
        {
          actorUserId: actor.id,
          action: AuditAction.USER_EDITED,
          entityType: AuditEntityType.USER,
          entityId: savedUser.id,
          metadata: { reactivated: true },
        },
        manager
      );

      return this.withoutPassword(savedUser);
    });
  }

  // Blocks any action that would leave zero *active, non-deleted*
  // super_admin accounts — the same "can't lock everyone out of the top
  // tier" rule GitHub orgs / AWS root accounts enforce. Used by both hard
  // delete and deactivation, since either one has the same practical
  // effect: nobody left who can authenticate as super_admin.
  private static async assertSuperAdminsRemainActive(manager: EntityManager, superAdminIdsBeingRemoved: string[]) {
    const repo = manager.getRepository(User);
    const totalActiveSuperAdmins = await repo.count({
      where: { role: UserRole.SUPER_ADMIN, isDeleted: false, isActive: true },
    });

    if (totalActiveSuperAdmins - superAdminIdsBeingRemoved.length <= 0) {
      throw new CustomAppError(
        "This action would leave the platform with no active super admin accounts",
        400,
        ErrorCodes.INVALID_STATE.code,
        ErrorCodes.INVALID_STATE.label,
        "last_super_admin"
      );
    }
  }

  static async delete(ids: string[], actor: UserActor) {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new CustomAppError("Invalid request IDs", 400, ErrorCodes.ID_REQUIRED.code, ErrorCodes.ID_REQUIRED.label, "bad_request");
    }

    const db = await AppDataSource();

    return db.transaction(async (manager: EntityManager) => {
      const repo = manager.getRepository(User);

      const records = await repo.find({
        where: { id: In(ids), isDeleted: false },
      });

      if (records.length === 0) {
        throw new CustomAppError("No matching records found to delete", 404, ErrorCodes.RECORD_NOT_FOUND.code, ErrorCodes.RECORD_NOT_FOUND.label, "not_found");
      }

      // All-or-nothing: if any targeted record is an admin/super_admin and
      // the actor isn't a super admin, reject the whole batch rather than
      // silently deleting the ones that were allowed. A partial silent skip
      // would be a confusing, easy-to-miss way to leave admin accounts
      // deleted alongside receptionists in the same request.
      if (actor.role !== UserRole.SUPER_ADMIN) {
        const blocked = records.filter((r) => ADMIN_TIER_ROLES.has(r.role) && r.id !== actor.id);
        if (blocked.length > 0) {
          throw new CustomAppError(
            "Only a super admin can delete an admin or super admin account",
            403,
            ErrorCodes.PERMISSION_DENIED.code,
            ErrorCodes.PERMISSION_DENIED.label,
            "forbidden"
          );
        }
        // A regular ADMIN acting here is only ever managing RECEPTIONIST
        // accounts (assertCanManageTarget's rule) or themselves — reject
        // anything else the same way single-record update/deactivate do.
        const unmanageable = records.filter(
          (r) => r.id !== actor.id && r.role !== UserRole.RECEPTIONIST
        );
        if (unmanageable.length > 0) {
          throw new CustomAppError(
            "You do not have permission to delete one or more of these user accounts",
            403,
            ErrorCodes.PERMISSION_DENIED.code,
            ErrorCodes.PERMISSION_DENIED.label,
            "forbidden"
          );
        }
      }

      const superAdminIdsInBatch = records.filter((r) => r.role === UserRole.SUPER_ADMIN).map((r) => r.id);
      if (superAdminIdsInBatch.length > 0) {
        await this.assertSuperAdminsRemainActive(manager, superAdminIdsInBatch);
      }

      records.forEach(record => {
        record.isDeleted = true;
        // A deleted account must never be able to authenticate again —
        // isDeleted alone already achieves that today (AuthService.login
        // filters on isDeleted: false), but keeping isActive in sync
        // avoids the two flags drifting apart if anything else ever
        // queries on isActive alone.
        record.isActive = false;
      });

      const savedRecords = await repo.save(records);

      for (const record of savedRecords) {
        await writeAuditLog(
          {
            actorUserId: actor.id,
            action: AuditAction.USER_DELETED,
            entityType: AuditEntityType.USER,
            entityId: record.id,
          },
          manager
        );
      }

      return savedRecords;
    });
  }
}
