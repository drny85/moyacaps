# Packing Checklist Implementation Plan

> **For agentic workers:** build with TDD (red → green, one slice at a time) at the seams listed below.

**Goal:** While an Order waits for a label, the Administrator ticks off each unit as it goes into the box, on the Order's page. Buying a label with units still unchecked asks for confirmation first, and the Orders list shows how far a half-packed Order got.

**Architecture:** The checklist is one optional field on the Order (`packingChecklist`), so no new table is needed. A pure module `convex/orders/packing.ts` holds every rule. A function module `convex/orders/packingChecklist.ts` has one admin mutation and two admin queries. The UI reads a computed view from the server, which already accounts for refunds. It never computes units on its own.

**Spec:** `CONTEXT.md` ("Packing Checklist", "Checked"), and the decisions below.

## Decisions (from the 2026-10-22 grilling)

1. Every Order gets a Packing Checklist, including a single cap.
2. You tick one unit at a time. A line shows `checked/remaining`; a tap adds one Checked unit and `−` undoes one.
3. Ticking happens straight from the Items list. The Packing sheet stays optional.
4. The checklist counts only units not yet refunded: line quantity minus the units on active (non-failed) refunds (`refundedQuantities`). A line with nothing left shows struck through and can't be ticked.
5. Ticks are stored on the Order in Convex.
6. Buy label (and Reship) asks for confirmation when the checklist is not complete. It is never blocked.
7. The checklist can be edited only while the Order can get a label: `labelAction(order).action` is `"buy"` or `"reship"`. Once a label is bought, the list is read-only and kept as a record. A Reship starts a fresh checklist.
8. If a unit is refunded after it was Checked (Checked > remaining), the line warns "take N out of the box". `−` is still allowed so you can fix it.
9. When the last unit is Checked, one admin-only event `packing_checklist_completed` goes on the Order Timeline, once per checklist. The Customer never sees it.
10. A row in the Orders list that can get a label shows a `checked/total` chip once any unit is Checked.
11. The printed packing slip doesn't change.

## Data

```ts
// orders table
packingChecklist: v.optional(v.object({
  forLabel: v.number(),        // label count when this checklist was ticked: 0 = first pack, 1 = first Reship, …
  checked: v.array(v.number()), // Checked units per line index
  completedAt: v.optional(v.number()), // set when the completion event was logged (once per checklist)
}))
```

A stored checklist is **live** when `forLabel === labelHistory(order).length` and the Order can get a label. If the Order can get a label but `forLabel` doesn't match, a fresh empty checklist applies (a Reship after a label was bought). If the Order can't get a label, the stored checklist is shown read-only.

## Seams under test

| Seam | Catches | Misses |
| --- | --- | --- |
| `convex/orders/packing.ts` (pure): `packingView(order, refunded)` and `planCheck(order, refunded, lineIndex, delta, now)` | remaining units after refunds; per-unit limits; overflow; editable vs frozen; a Reship starts fresh; completion logged once | auth, DB reads, ledger loading |
| `convex/orders/packingChecklist.ts` through convex-test: `checkUnit`, `getPackingChecklistAdmin`, `packingProgressAdmin` | admin-only access; the ledger really feeds the view; the timeline event is written once; the lock after a label is bought | UI rendering |

The UI (Items counter, label confirm, list chip) is checked in the browser, not unit-tested. That matches how other `src/components/admin` code is verified.

## Tasks

### Task 1: Pure rules (`convex/orders/packing.ts`, `packing.test.ts`)

- `type PackingLineView = { remaining: number; checked: number; overflow: number }`
- `type PackingView = { editable: boolean; lines: PackingLineView[]; checkedUnits: number; totalUnits: number; uncheckedUnits: number; complete: boolean }`
- `packingView(order, refunded: number[]): PackingView`
- `planCheck(order, refunded, lineIndex, delta: 1 | -1, now): { ok: true; checklist: PackingChecklist; completed: boolean } | { ok: false; error: string }`

### Task 2: Schema + functions (`convex/schema.ts`, `convex/orders/packingChecklist.ts`, `packingChecklist.test.ts`)

- `checkUnit({ orderId, lineIndex, delta })`: admin only. Applies `planCheck`, patches the Order, and on `completed` inserts `packing_checklist_completed`.
- `getPackingChecklistAdmin({ orderId })`: returns `PackingView | null`.
- `packingProgressAdmin({ orderIds })`: returns `{ orderId, checkedUnits, totalUnits }[]` for at most 100 ids.

### Task 3: UI

- `ItemsSection`: per-line `checked/remaining` counter. Tapping the row's tick area adds one; a `−` button undoes one; a fully refunded line is struck through; an overflow line shows a warning; frozen lists are read-only. The thumbnail still opens the Packing sheet.
- `OrderDetailPage` and `OrdersList`: Buy label / Reship go through a `ConfirmDialog` when the checklist is not complete.
- `OrderRow`: `checked/total` chip.
- `src/lib/admin/orderTimeline.ts`: title for `packing_checklist_completed`.
- Copy goes into `src/messages/en.json` and `src/messages/es.json` together.

## Verification

- `npx vitest run convex/orders/packing.test.ts convex/orders/packingChecklist.test.ts`
- `npx tsc --noEmit`, then the full `npm test`
- Browser: tick and un-tick on a Needs Packing Order, reload and confirm the ticks persist, confirm the label prompt appears, and confirm the list chip shows.
- Convex prod deploys are manual (the user's call).
