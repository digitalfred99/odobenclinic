"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Button } from "@/components/ui/button";
import { AGE_BANDS, MISSING_LABELS, WEEKDAYS } from "@/lib/reports/analytics";
import { EMPTY_SLICE, type MissingKey, type Slice } from "@/lib/reports/types";

export type Vocab = { areas: string[]; towns: string[]; districts: string[]; regions: string[] };

const selectClass = "flex h-11 w-full rounded-md border border-border bg-background px-3 text-sm";

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-medium text-foreground">{label}</label>
      {children}
    </div>
  );
}

/** A bottom sheet on phones and a side panel from md up. */
export function FilterSheet({ open, onOpenChange, slice, onChange, vocab }: {
  open: boolean; onOpenChange: (open: boolean) => void; slice: Slice; onChange: (next: Slice) => void; vocab: Vocab;
}) {
  const set = <K extends keyof Slice>(key: K, value: Slice[K]) => onChange({ ...slice, [key]: value });
  const options = (list: string[]) => list.map((v) => <option key={v} value={v}>{v}</option>);

  return (
    <Dialog.Root open={open} modal onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="pointer-events-auto touch-none fixed inset-0 z-[100] bg-foreground/40 print:hidden" />
        <Dialog.Popup className="fixed inset-x-0 bottom-0 z-[101] flex max-h-[88dvh] flex-col rounded-t-2xl border border-border bg-card text-card-foreground shadow-xl outline-none md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-96 md:rounded-none print:hidden">
          <div className="border-b border-border px-5 py-4">
            <Dialog.Title className="text-lg font-semibold text-foreground">Filters</Dialog.Title>
            <Dialog.Description className="mt-1 text-sm text-muted-foreground">Everything updates instantly. Nothing reloads.</Dialog.Description>
          </div>
          <div className="space-y-4 overflow-y-auto px-5 py-4">
            <Field id="f-sex" label="Sex">
              <select id="f-sex" className={selectClass} value={slice.sex} onChange={(e) => set("sex", e.target.value as Slice["sex"])}>
                <option value="">All</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other or unknown</option>
              </select>
            </Field>
            <Field id="f-marital-status" label="Marital status">
              <select id="f-marital-status" className={selectClass} value={slice.maritalStatus} onChange={(e) => set("maritalStatus", e.target.value as Slice["maritalStatus"])}>
                <option value="">All statuses</option>
                <option value="single">Single</option>
                <option value="married">Married</option>
                <option value="divorced">Divorced</option>
                <option value="widowed">Widowed</option>
                <option value="unknown">Not recorded</option>
              </select>
            </Field>
            <Field id="f-age" label="Age group">
              <select id="f-age" className={selectClass} value={slice.ageBand} onChange={(e) => set("ageBand", e.target.value)}>
                <option value="">All ages</option>{options(AGE_BANDS.map((b) => b.label))}<option value="Unknown">Age not recorded</option>
              </select>
            </Field>
            <Field id="f-type" label="Visit type">
              <select id="f-type" className={selectClass} value={slice.type} onChange={(e) => set("type", e.target.value as Slice["type"])}>
                <option value="">All</option><option value="new">New</option><option value="returning">Returning</option>
              </select>
            </Field>
            <Field id="f-weekday" label="Weekday">
              <select id="f-weekday" className={selectClass} value={slice.weekday ?? ""} onChange={(e) => set("weekday", e.target.value === "" ? null : Number(e.target.value))}>
                <option value="">Every day</option>{WEEKDAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
              </select>
            </Field>
            <Field id="f-region" label="Region">
              <select id="f-region" className={selectClass} value={slice.region} onChange={(e) => set("region", e.target.value)}>
                <option value="">All regions</option>{options(vocab.regions)}
              </select>
            </Field>
            <Field id="f-district" label="District">
              <select id="f-district" className={selectClass} value={slice.district} onChange={(e) => set("district", e.target.value)}>
                <option value="">All districts</option>{options(vocab.districts)}
              </select>
            </Field>
            <Field id="f-town" label="Town">
              <select id="f-town" className={selectClass} value={slice.town} onChange={(e) => set("town", e.target.value)}>
                <option value="">All towns</option>{options(vocab.towns)}
              </select>
            </Field>
            <Field id="f-area" label="Area">
              <select id="f-area" className={selectClass} value={slice.area} onChange={(e) => set("area", e.target.value)}>
                <option value="">All areas</option>{options(vocab.areas)}
              </select>
            </Field>
            <Field id="f-missing" label="Registration records (Patients list)">
              <select id="f-missing" className={selectClass} value={slice.missing} onChange={(e) => set("missing", e.target.value as MissingKey | "")}>
                <option value="">All records</option>
                {(Object.keys(MISSING_LABELS) as MissingKey[]).map((k) => <option key={k} value={k}>{MISSING_LABELS[k]}</option>)}
              </select>
            </Field>
          </div>
          <div className="flex gap-3 border-t border-border px-5 py-4">
            <Button type="button" variant="secondary" className="min-h-11 flex-1" onClick={() => onChange(EMPTY_SLICE)}>Clear all</Button>
            <Button type="button" className="min-h-11 flex-1" onClick={() => onOpenChange(false)}>Done</Button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
