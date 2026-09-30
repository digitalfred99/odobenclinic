import { Entity, Column, ManyToOne, JoinColumn, CreateDateColumn, PrimaryGeneratedColumn, type Relation } from "typeorm";
import { User } from "./User";

@Entity("audit_logs")
export class AuditLog {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne(() => User, (user) => user.auditLogs, { nullable: true })
  @JoinColumn({ name: "actor_id" })
  actor?: Relation<User>;

  @Column({nullable: false})
  action!: string;

  @Column({ name: "entity_type", nullable: false })
  entityType!: string;

  @Column({ name: "entity_id", nullable: true })
  entityId?: string;

  @Column({ type: "jsonb", nullable: true })
  metadata?: Record<string, unknown>;

  @Column({ name: "ip_address", nullable: true })
  ipAddress?: string;

  @Column({ name: "user_agent", nullable: true })
  userAgent?: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}