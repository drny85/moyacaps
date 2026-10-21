# Admin Drops Implementation Plan (plan 0009, PR 4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the Drops page (1097 lines, five inline modals, `any`, hardcoded English, `alert()` on errors) up to the Products standard without changing what it does: a drop card list, a subscribers table with CSV export, one schedule dialog and one confirm dialog.

**Architecture:** Two pure modules: `src/lib/admin/dropCard.ts` (card view model, countdown, page metrics, which Products can still be scheduled) and `src/lib/admin/subscribersCsv.ts` (filter, CSV rows, file text, filename). A hook `useDrops` wraps the three queries and five mutations; thin components under `src/components/admin/drops/`. The existing `DropScheduleDialog` handles schedule, postpone and badge edits (its `onSave` maps to `scheduleDrop` / `cancelDrop`); the shared `ConfirmDialog` (PR 3) handles Release now and Delete. No Convex changes.

**Tech Stack:** Next.js 16 App Router, React 19, Convex, next-intl, Tailwind, Vitest, Bun.

**Spec:** `docs/plans/0009-admin-ops-redesign.md` (D4, D9, D22, D24; Screen 6). **Branch:** `feat/admin-drops`, stacked on `feat/admin-order-detail` (PR 3) for `ConfirmDialog`.

## Global Constraints

- Scope: `src/lib/admin/{dropCard,subscribersCsv}.ts` (+tests), `src/components/admin/drops/**` (new), `src/app/[locale]/admin/drops/page.tsx` (replaced, ~15 lines), `src/messages/{en,es}.json` (`admin.drops.*` rewritten). `DropScheduleDialog`, `DateTimePicker`, `ConfirmDialog`, `QueryErrorBoundary`, `EmptyState` reused unchanged.
- Pure modules use relative imports; `computedDropStatus` and `hasDropHistory` come from `../../../convex/catalog/model` (pure).
- Domain terms: Drop (CONTEXT.md), Product, Catalog Shot, Available Inventory. No "VIP", "launchpad", "radar", "telemetry" in copy.
- CSV filename `good-luck-drop-subscribers-YYYY-MM-DD.csv`; fields quoted and escaped per RFC 4180 (double quotes doubled); UTF-8 BOM so Excel/Numbers read accents.
- Errors never `alert()`: they render in the open dialog (`ConfirmDialog` `error`, `DropScheduleDialog` already shows its own) or in a page banner.
- `/` focuses the subscriber search (D24). Zero `any`; copy in both locales.
- Gates before every commit: `bun run test`, `bunx tsc --noEmit`, `bunx tsc --noEmit -p convex`.

## Review Focus

1. A subscriber name or Product name containing a comma, a quote or a newline must not break the CSV row. → Task 2 test.
2. A drop whose `dropDate` passed but whose `dropStatus` is still `scheduled` (cron not yet run) must show as **Live** with "Launched", not a negative countdown. → Task 1 countdown `past: true` and `computedDropStatus` test.
3. Deleting a drop with "also delete subscribers" unchecked must keep the alerts; the checkbox default is **unchecked** (the old page defaulted to purge). → Task 3 dialog default and preview.
4. The schedule dialog for a Product that already has a live drop must not offer scheduling into the past; `DateTimePicker`'s `minDate` is `Date.now()`. → covered by the dialog; preview check.
5. Products whose drop was deleted (no drop fields) reappear in the "schedule a drop" picker; archived Products never do. → Task 1 `schedulableProducts` test.

---

### Task 1: `dropCard.ts`

**Files:**
- Create: `src/lib/admin/dropCard.ts`, `src/lib/admin/dropCard.test.ts`

**Interfaces:**
```ts
import { computedDropStatus, hasDropHistory } from "../../../convex/catalog/model";
export type DropRowInput = {           // the adminDropRow fields the page reads
  variantId: string; nameEn: string; nameEs: string; image: string; catalogShot?: string; silhouette: string;
  stock: number; isDrop?: boolean; dropDate?: number; dropStatus?: "scheduled" | "live" | "archived";
  dropBadgeTextEn?: string; dropBadgeTextEs?: string; subscribersCount: number; computedStatus: "scheduled" | "live" | "archived";
  archivedAt?: number;
};
export type Countdown = { d: number; h: number; m: number; s: number; past: boolean };
export function countdown(target: number, now: number): Countdown;
export type DropCardVM = {
  variantId: string; name: string; image: string; status: "scheduled" | "live" | "archived";
  dateLabel?: string;                   // toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" })
  countdown?: Countdown;                // scheduled only
  subscribers: number; stock: number; badge?: string;   // badge by locale
  canRelease: boolean; canReschedule: boolean; canCancel: boolean;   // scheduled → all true; live → reschedule only false... see tests
};
export function toDropCard(row: DropRowInput, locale: "en" | "es", now: number): DropCardVM;
export type DropMetrics = { scheduled: number; live: number; subscribers: number; nextDropAt?: number };
export function dropMetrics(rows: DropRowInput[], now: number): DropMetrics;
/** Products with no drop history and not archived: the "schedule a drop" picker. */
export function schedulableProducts<T extends { isDrop?: boolean; dropDate?: number; dropStatus?: string; archivedAt?: number }>(rows: T[]): T[];
```
Rules: `canRelease` = status `scheduled`; `canReschedule` = status `scheduled` or `live` (a live drop may get a new date, which re-schedules it); `canCancel` = status `scheduled` or `live`. `image` = `catalogShot || image`. `countdown` uses floor division; `past` when `target <= now`. `dropMetrics.nextDropAt` = earliest `dropDate` among scheduled rows with `dropDate > now`.

- [ ] **Step 1: Tests**: `"countdown splits days/hours/minutes/seconds and flags the past"` (`target = now + 2d 3h 4m 5s` → `{2,3,4,5,false}`; `target = now` → past); `"a scheduled drop carries its countdown and date"`; `"a drop past its date reads as live even before the cron flips it"` (row with `computedStatus: "live"`, `dropStatus: "scheduled"`, `dropDate < now` → `status: "live"`, no countdown); `"names and badge follow the locale"`; `"capabilities by status"` (scheduled: release/reschedule/cancel all true; live: release false, reschedule true, cancel true; archived: all false); `"metrics count scheduled and live, sum subscribers, find the next date"`; `"schedulable excludes drop history and archived"`.
- [ ] **Step 2: RED.** **Step 3: Implement.** **Step 4: GREEN.** **Step 5: Commit** `feat(admin): drop card view model and metrics`.

### Task 2: `subscribersCsv.ts`

**Files:**
- Create: `src/lib/admin/subscribersCsv.ts`, `src/lib/admin/subscribersCsv.test.ts`

**Interfaces:**
```ts
export type SubscriberInput = { _id: string; variantId: string; contact: string; channel: "whatsapp" | "email"; name?: string; locale: "en" | "es"; createdAt: number; variantNameEn: string; variantNameEs: string };
export type SubscriberFilters = { q: string; variantId: string | "all" };
export function filterSubscribers(subs: SubscriberInput[], f: SubscriberFilters): SubscriberInput[];   // q matches contact, name, either Product name, case-insensitive
export const CSV_HEADERS = ["Contact", "Channel", "Name", "Product", "Slug", "Signed up", "Locale"] as const;
export function toCsvRows(subs: SubscriberInput[], locale: "en" | "es"): string[][];   // Product name by locale; Signed up as ISO
export function csvText(rows: string[][]): string;      // BOM + header + rows, CRLF, RFC 4180 quoting
export function csvFilename(now: number): string;       // good-luck-drop-subscribers-YYYY-MM-DD.csv
```

- [ ] **Step 1: Tests**: `"filters by product and by text across contact, name and product names"`; `"rows carry the localized product name and an ISO date"`; `"quotes fields with commas, quotes and newlines"` (name `O'Brien, "Big" Jim\nJr` → `"O'Brien, ""Big"" Jim\nJr"`); `"text starts with a BOM and uses CRLF"`; `"filename carries the date"`.
- [ ] **Step 2: RED.** **Step 3: Implement.** **Step 4: GREEN.** **Step 5: Commit** `feat(admin): subscriber filter and CSV export as pure functions`.

### Task 3: Components, hook, page, copy

**Files:**
- Create: `src/components/admin/drops/useDrops.ts`, `DropsPage.tsx`, `DropMetrics.tsx`, `DropCard.tsx`, `DropCardsSkeleton.tsx`, `SubscribersTable.tsx`, `DeleteDropDialog.tsx`
- Replace: `src/app/[locale]/admin/drops/page.tsx`
- Modify: `src/messages/{en,es}.json` (`admin.drops.*` rewritten)

**Interfaces:**
- `useDrops()`: `drops = useQuery(getAllDropsAdmin, { clientTime })`, `catalog = useQuery(getAllProductsAdmin, {})`, `subscribers = useQuery(getDropSubscribersList, {})`; `busy`, `error`, `success`, `dismissError`; actions `schedule({ variantId, isDrop, dropDate?, dropBadgeTextEn?, dropBadgeTextEs? })` (→ `scheduleDrop` when `isDrop && dropDate`, else `cancelDrop`; this is the `DropScheduleDialog.onSave` shape and must **throw** on failure so the dialog shows the error), `release(variantId)` → `releaseDropNow({ variantId, keepBadge: true })`, `remove(variantId, deleteSubscribers)` → `deleteDrop`. Successes set `success` from `admin.drops.toast.*`.
- `DropsPage`: `h1`, `DropMetrics` (four tiles: scheduled, live, subscribers, next drop with a live `countdown` ticking each second via a 1 s interval only while a next drop exists), **Schedule a drop** button → a small picker (`<select>` of `schedulableProducts(catalog.variants)` by localized name) that opens `DropScheduleDialog` with `target = { ...row, isDrop: true, dropDate: undefined }` so the dialog starts enabled with its default date; the drop card list (2 columns at `md`, 3 at `xl`); `SubscribersTable`. States: skeleton, `EmptyState` with `admin.drops.empty` when no drops, `QueryErrorBoundary` retry.
- `DropCard`: Catalog Shot 4:5 top, status pill (`admin.drops.status.*`), name, date, countdown (`Xd Xh Xm` ticking per second while scheduled), subscribers and stock counts, badge text, footer buttons: **Release now** (`canRelease`, primary amber, → `ConfirmDialog`), **Reschedule** (`canReschedule`, → `DropScheduleDialog` with the row as target), **Cancel drop** (`canCancel`, → `ConfirmDialog` destructive), **Delete** (⋯ or text link, → `DeleteDropDialog`).
- `DeleteDropDialog`: `ConfirmDialog` destructive with a checkbox `admin.drops.delete.alsoSubscribers` **unchecked by default**; passes `deleteSubscribers`.
- `SubscribersTable`: search (`/` focuses, via `useAdminShortcuts`), Product `<select>` (all + each Product present in the list), count, **Export CSV** button (`csvText` → `Blob` → object URL → click → revoke), table on `md+` / stacked rows on phone: contact, channel icon, name, Product, signed-up date. Empty state `admin.drops.subscribers.empty`.
- Copy `admin.drops.{title, scheduleDrop, pickProduct, pickProductHelp, noneToSchedule, metrics.{scheduled, live, subscribers, next, none}, status.{scheduled, live, archived}, card.{launches, launched, subscribers, stock, release, reschedule, cancel, delete}, release.{title, body, confirm}, cancel.{title, body, confirm}, delete.{title, body, alsoSubscribers, confirm}, empty, emptyBody, subscribers.{title, search, allProducts, export, contact, channel, name, product, signedUp, empty, count}, toast.{scheduled, released, cancelled, deleted}}` in both locales. Remove every old `admin.drops.*` key (verify no caller: `grep -rn "admin.drops" src` outside the new folder → the Products grid's `dropsDesk` link label lives under `admin.products.grid`, untouched).

- [ ] **Step 1: Hook and components; replace the route; delete the old page.**
- [ ] **Step 2: Copy in both locales; parity check.**
- [ ] **Step 3: Gates** — `bun run test && bunx tsc --noEmit && bunx tsc --noEmit -p convex`; `grep -rn "alert(\|: any\|VIP" src/components/admin/drops "src/app/[locale]/admin/drops"` → no output.
- [ ] **Step 4: Preview** (phone and desktop, EN and ES): metrics, a scheduled card with a ticking countdown, Schedule a drop → pick a Product → dialog → save; Reschedule; Release now behind the confirm; Delete shows the unchecked subscribers box; Export CSV downloads a file whose name starts with `good-luck-drop-subscribers-`; `/` focuses the search; a Product search narrows the table.
- [ ] **Step 5: Commit** `feat(admin): Drops as cards with one schedule dialog and one confirm`.
