import { Entity, Column, OneToMany, type Relation, Index } from "typeorm";
import { AppBaseEntity } from "./BaseEntity";
import { AuditLog } from "./AuditLog";

export enum UserRole {
  SUPER_ADMIN = "super_admin",
  ADMIN = "admin",
  RECEPTIONIST = "receptionist",
}

@Entity("users")
@Index("UQ_users_phone_active", ["phone"], {
  unique: true,
  where: '"isDeleted" = false',
})
export class User extends AppBaseEntity {
  @Column({type: "varchar", length: 255, nullable: false})
  firstName!: string;

  @Column({type: "varchar", length: 255, nullable: false})
  lastName!: string;

  @Column({ length: 255, nullable: true })
  email!: string;

  @Column({ unique: true, length: 20, nullable: false })
  phone!: string;

  @Column({ name: "password_hash", nullable: false })
  passwordHash!: string;

  @Column({ type: "enum", enum: UserRole, default: UserRole.ADMIN })
  role!: UserRole;

  @Column({ type: "boolean", default: true })
  isActive!: boolean;

  @OneToMany(() => AuditLog, (log) => log.actor)
  auditLogs!: Relation<AuditLog[]>;
}