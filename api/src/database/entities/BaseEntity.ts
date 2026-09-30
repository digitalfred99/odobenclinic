import {
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Column,
} from "typeorm";

export abstract class AppBaseEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "boolean", default: false })
  isDeleted!: boolean;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;
}