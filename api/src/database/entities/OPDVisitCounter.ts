import { Entity, PrimaryColumn, Column } from "typeorm";

/**
 * One row per calendar year, holding the last OPD visit position handed
 * out for that year. This is what makes "12/2026" a real, gapless,
 * concurrency-safe sequence rather than something derived from
 * COUNT(*) — two receptionists submitting visits at the same instant
 * must never be handed the same position.
 *
 * OPDVisitService.create() acquires this row with a pessimistic lock
 * inside the same transaction as the visit insert (SELECT ... FOR
 * UPDATE, creating the row on first use for a new year), increments it,
 * and uses the result as positionInYear. The lock is held only for the
 * duration of that transaction, so it briefly serializes visit creation
 * within the same year — negligible for a clinic's registration volume.
 */
@Entity("opd_visit_counters")
export class OPDVisitCounter {
  @PrimaryColumn({ type: "int" })
  year!: number;

  @Column({ type: "int", default: 0 })
  lastPosition!: number;
}
