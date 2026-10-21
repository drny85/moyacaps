/** The steps the Photo Autofill progress dialog lists, and where a run stands in them. */

export type AutofillPhase = "preparing" | "reading";
export type AutofillStepKey = "prepare" | "read" | "fill";
export type AutofillStepState = "done" | "active" | "pending";

const STEPS: readonly AutofillStepKey[] = ["prepare", "read", "fill"];
const ACTIVE: Record<AutofillPhase, number> = { preparing: 0, reading: 1 };

export function autofillSteps(phase: AutofillPhase): { key: AutofillStepKey; state: AutofillStepState }[] {
  const active = ACTIVE[phase];
  return STEPS.map((key, i) => ({ key, state: i < active ? "done" : i === active ? "active" : "pending" }));
}
