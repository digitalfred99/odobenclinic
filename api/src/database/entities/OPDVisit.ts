import { Entity, Column, ManyToOne, JoinColumn, Index } from "typeorm";
import { AppBaseEntity } from "./BaseEntity";
import { User } from "./User";
import { Patient } from "./Patient";

export enum NewReturning {
  NEW = "new",
  RETURNING = "returning",
}

@Entity("opd_visits")
// Reporting and the receptionist dashboard both filter/group by visit
// date very heavily ("today", "this week", custom range) — index it.
@Index("IDX_opd_visits_date", ["date"])
// TypeORM does not automatically index @ManyToOne foreign key columns.
// Both of these are joined/filtered on constantly (patient history,
// "visits created by user X"), so index them explicitly.
@Index("IDX_opd_visits_patient_id", ["patient"])
@Index("IDX_opd_visits_created_by_id", ["createdBy"])
export class OPDVisit extends AppBaseEntity {
  // NOTE: there is no per-visit number here. The clinic's OPD number is
  // fixed per PATIENT, assigned once at registration and reused on
  // every visit — see Patient.patientId. A visit is identified by that
  // (unchanging) patientId plus its own `date`; it does not get its own
  // sequential number. An earlier version of this entity had
  // opdNumber/year/positionInYear here (one new number per visit) —
  // that was based on a misunderstanding of the clinic's actual card
  // format and has been moved to Patient.

  @Column({ type: "date", nullable: false })
  date!: string;

  @Column({ type: "text", nullable: true })
  remarks?: string;

  // Whether this was the patient's first-ever visit (NEW) or a
  // subsequent one (RETURNING). This is decided once, at creation time
  // (see OPDVisitService.create), from whether any earlier non-deleted
  // visit already existed for the patient. It is intentionally a stored,
  // immutable historical fact rather than something recomputed on read:
  // "was this visit new/returning" should never change after the fact
  // just because, say, an earlier visit is later cancelled. It backs the
  // dashboard's "new vs returning patients today" counts and the OPD
  // visit report's New/Returning column without an expensive correlated
  // subquery per row.
  @Column({ type: "enum", enum: NewReturning, nullable: false })
  newReturning!: NewReturning;

  // Historical integrity: an OPD visit is a permanent attendance record.
  // CASCADE here would mean deleting a Patient row silently wipes out
  // every visit that ever referenced them — exactly the kind of data
  // loss the clinic's paper OPD book was never at risk of. Patients are
  // only ever soft-deleted in this system (Patient.isDeleted), so this
  // FK should never actually fire in practice; RESTRICT makes sure that,
  // if a hard delete is ever attempted (e.g. a manual DB cleanup), it
  // fails loudly instead of quietly erasing history.
  @ManyToOne(() => Patient, { nullable: false, onDelete: "RESTRICT" })
  @JoinColumn({ name: "patient_id" })
  patient!: Patient;

  @ManyToOne(() => User, { nullable: false, onDelete: "RESTRICT" })
  @JoinColumn({ name: "created_by_id" })
  createdBy!: User;
}
