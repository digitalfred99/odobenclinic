import { Entity, PrimaryColumn, Column } from "typeorm";

/**
 * One row per calendar year, holding the last patient registration
 * position handed out. This is what makes "PT-12/2026" a real,
 * gapless, concurrency-safe sequence rather than something derived
 * from COUNT(*) — two receptionists registering patients at the same
 * instant must never be handed the same position, and a deleted
 * patient's position must never be reused (see Patient.patientId).
 *
 * PatientService.create() acquires this row with a pessimistic lock
 * inside the same transaction as the patient insert (SELECT ... FOR
 * UPDATE, creating the row on first use for a new year), increments
 * it, and uses the result as positionInYear. The lock is held only for
 * the duration of that transaction.
 */
@Entity("patient_counters")
export class PatientCounter {
  @PrimaryColumn({ type: "int" })
  year!: number;

  @Column({ type: "int", default: 0 })
  lastPosition!: number;
}
