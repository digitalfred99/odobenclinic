import { Entity, Column, ManyToOne, JoinColumn, Index } from "typeorm";
import { AppBaseEntity } from "./BaseEntity";
import { User } from "./User";

export enum Gender {
  FEMALE = "female",
  MALE = "male",
}

export enum MaritalStatus {
  SINGLE = "single",
  MARRIED = "married",
  DIVORCED = "divorced",
  WIDOWED = "widowed",
}

@Entity("patients")
// Patient search and duplicate detection both look patients up by name
// and by phone constantly, on a table that's expected to grow into the
// thousands. Without these, every such lookup is a full table scan.
@Index("IDX_patients_last_first_name", ["lastName", "firstName"])
@Index("IDX_patients_phone", ["phone"])
@Index("IDX_patients_date_of_birth", ["dateOfBirth"])
// The real, queryable source of truth for the patient's permanent
// number — see the comment on positionInYear below. patientId is just
// the formatted display string derived from these two.
@Index("UQ_patients_year_position", ["year", "positionInYear"], { unique: true })
export class Patient extends AppBaseEntity {
  // The clinic's one fixed, permanent number for this person — e.g.
  // "PT-12/2026" means they were the 12th patient ever registered at
  // the clinic in 2026. Assigned exactly once, at registration, from
  // year + positionInYear below, and never changes again: not on
  // update, not on soft delete, not on restore. This is deliberately
  // unique across ALL patients including soft-deleted ones (no
  // "only unique while active" exception) — a retired ID must never be
  // handed to someone else, since the same physical card carrying this
  // number may resurface years later.
  @Column({type: "varchar", length: 20, unique: true, nullable: false})
  patientId!: string;

  // Calendar year the patient was first registered — permanent, not
  // tied to their most recent visit. Its own column (rather than
  // derived from createdAt at query time) so the (year, positionInYear)
  // uniqueness constraint above can be enforced by Postgres directly.
  @Column({ type: "int", nullable: false })
  year!: number;

  // This patient's sequential registration position within `year`,
  // assigned once via an atomic per-year counter (PatientCounter — see
  // patient.service.ts) so two concurrent registrations can never
  // receive the same position. Never reused: deleting a patient does
  // not roll the counter back, so a retired positionInYear/patientId is
  // gone for good, even if the patient is later restored.
  @Column({ type: "int", nullable: false })
  positionInYear!: number;

  @Column({type: "varchar", length: 255, nullable: false})
  firstName!: string;

  @Column({type: "varchar", length: 255, nullable: false})
  lastName!: string;

  @Column({ type: "date", nullable: true })
  dateOfBirth?: string;

  @Column({ type: "int", nullable: true })
  age?: number;

  @Column({ length: 20, nullable: true })
  phone?: string;

  @Column({length: 20, nullable: true})
  region?: string;

  @Column({length: 100, nullable: true})
  district?: string;

  @Column({length: 100, nullable: true})
  town?: string;

  @Column({ length: 100, nullable: true })
  area?: string;

  @Column({ type: "enum", enum: Gender, nullable: false })
  gender!: Gender;

  @Column({ type: "enum", enum: MaritalStatus, nullable: false })
  maritalStatus!: MaritalStatus;

  // Who registered this patient, permanently — distinct from
  // OPDVisit.createdBy, which records who logged each individual
  // attendance. RESTRICT for the same historical-integrity reason as
  // OPDVisit's relations: a patient record must never be able to
  // silently lose its "registered by" reference to a hard delete.
  @ManyToOne(() => User, { nullable: false, onDelete: "RESTRICT" })
  @JoinColumn({ name: "created_by_id" })
  createdBy!: User;
}
