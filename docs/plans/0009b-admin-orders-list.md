# Admin Orders List Implementation Plan (plan 0009, PR 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 1660-line Orders page (table + drawer + modals) with a phone-first card list driven by seven queues, a date range and search in the URL, with one quick action per row and no drawer.

**Architecture:** The desk query grows real queues (`shipped`, `problems`, `done`), the `needs_packing` id and a `since` bound, so one server call answers one queue. A pure module `src/lib/admin/orderFilters.ts` owns the URL state and `src/lib/admin/orderRow.ts` builds the row view model; thin components under `src/components/admin/orders/` render them. Row tap navigates to the existing detail page, which keeps every action until PR 3. The drawer, its modals, the payment-method filter and every WhatsApp surface on the list are deleted.

**Tech Stack:** Next.js 16 App Router, React 19, Convex (`convex-test`), next-intl, Tailwind, Vitest, Bun.

**Spec:** `docs/plans/0009-admin-ops-redesign.md` (D5, D6, D9–D12, D17, D24; Backend gap 5; Screen 4). **Branch:** `feat/admin-orders-list`, stacked on `feat/admin-shell-home-settings` (PR 1) because it needs the sidebar, `admin.common.*` and the `?queue=` contract from Home.

## Global Constraints

- Scope: `convex/orders/{deskFilters,desk}.ts` and their tests, `convex/orders/statusSplit.test.ts`, `convex/orders/returnContracts.test.ts`, `src/lib/orderStatus.ts` (+test), `src/lib/admin/{orderFilters,orderRow}.ts` (+tests), delete `src/lib/admin/queueParam.ts` (+test), `src/components/admin/orders/**` (new), `src/app/[locale]/admin/orders/page.tsx` (replaced), `src/messages/{en,es}.json` (`admin.orders.*` rewritten). The detail page `orders/[orderNumber]/page.tsx` is untouched.
- Pure modules in `src/lib/admin/` use relative imports and import nothing from React or Convex (types from `convex/orders/status` are fine via `../../../convex/...` type imports).
- Queues, in display order: `needs_packing · overdue · awaiting_payment · shipped · problems · done · all`. Shipped = `label_purchased` + `in_transit`; Problems = `delivery_exception` + `returned` + `disputed`; Done = `delivered` + `refunded` + `partially_refunded`; `cancelled` appears only under `all`. Overdue = Needs Packing older than 24 h.
- Ranges: `today · 7d · 30d · all`; default `30d`. `all` keeps the 250 cap and shows `admin.common.showingLatest`.
- URL params: `?queue=&range=&q=`; defaults are omitted from the URL.
- One quick action per row: **Buy label** when `labelAction(order).action === "buy"`, **Reship** when `"reship"`, nothing otherwise.
- Zero `any` in files this plan creates or replaces. All copy under `admin.orders.*` in both locales.
- Gates before every commit: `bun run test`, `bunx tsc --noEmit`, `bunx tsc --noEmit -p convex`. No migrations, no `convex run`, no deploy.

## Review Focus

1. A paid order from exactly 24 h ago is Overdue only once the 24 h have fully passed; both the server filter and the row's red age must agree at the boundary. → Task 1 and Task 3 tests at `now - DAY` and `now - DAY - 1`.
2. `?range=today` must use the Administrator's local midnight, not UTC. → Task 2 `sinceFor("today", now, tzOffsetMinutes)` test with a New York offset.
3. `?queue=junk&range=junk` must fall back to the defaults, not crash. → Task 2 test.
4. A `done` queue must not list a refunded order that is also cancelled twice, and `problems` must not include a disputed order that was later refunded (payment status moved on). → Task 1 `matchesDeskFilter` tests.
5. The old `?order=GL-1042` deep link (from any bookmark) must still land somewhere useful: redirect to `/admin/orders/GL-1042`. → Task 4 test of `legacyOrderParamHref` and a preview check.

---

### Task 1: Desk queues, the `needs_packing` id and `since`

**Files:**
- Modify: `convex/orders/deskFilters.ts`, `convex/orders/deskFilters.test.ts`, `convex/orders/desk.ts:123-155` (`getAllOrdersAdmin`) and `readDeskFilter`, `convex/orders/statusSplit.test.ts:246`, `convex/orders/returnContracts.test.ts:205-207`, `src/lib/orderStatus.ts:130-143`, `src/lib/orderStatus.test.ts:95`

**Interfaces:**
- Produces: `DESK_FILTERS` = `["all","needs_packing","overdue","awaiting_payment","shipped","problems","done","label_purchased","in_transit","delivered","delivery_exception","returned","partially_refunded","refunded","disputed","cancelled"]`; `LEGACY_FILTERS` gains `needs_attention: "needs_packing"`; `matchesDeskFilter` handles the three composites; `getAllOrdersAdmin` args become `{ clientTime: number; status?: string; search?: string; since?: number; limit?: number }` (`paymentMethod` removed); orders older than `since` are dropped after the index read.
- `ADMIN_DESK_TABS` in `src/lib/orderStatus.ts` lists the same ids (its test asserts equality with `DESK_FILTERS`); labels there are unused by the new list and stay English for the test.

- [ ] **Step 1: Extend `deskFilters.test.ts`**

Add: `parseDeskFilter("needs_attention")` → `"needs_packing"`; `tabsOf(order("paid","label_purchased"))` includes `"shipped"` and not `"done"`; `tabsOf(order("paid","delivery_exception"))` includes `"problems"`; `tabsOf(order("disputed","in_transit"))` includes `"problems"` and `"shipped"`; `tabsOf(order("refunded","delivered"))` includes `"done"` exactly once and not `"problems"`; `tabsOf(order("refunded","unfulfilled",{cancelledAt: NOW}))` includes `"all"` and `"cancelled"` and `"done"` is **not** included (cancelled orders live under All only). Overdue boundary: `createdAt: NOW - DAY` is not overdue, `NOW - DAY - 1` is. Rename every `needs_attention` expectation to `needs_packing`.

- [ ] **Step 2: Run to see them fail** — `bunx vitest run convex/orders/deskFilters.test.ts`, FAIL.

- [ ] **Step 3: Implement in `deskFilters.ts`**

`done`: `!isCancelled && (fulfillment === "delivered" || payment in ["refunded","partially_refunded"])`. `problems`: `!isCancelled && (fulfillment in ["delivery_exception","returned"] || payment === "disputed")`. `shipped`: `fulfillment in ["label_purchased","in_transit"]`. Overdue uses `<=`? No: keep `createdAt < now - ONE_DAY_MS` so exactly 24 h is not yet overdue.

- [ ] **Step 4: `desk.ts`**

`readDeskFilter`: `needs_packing`/`overdue` → `packingQueue`; `shipped` → `newestFirst` of the two `by_fulfillmentStatus` reads; `problems` → `by_fulfillmentStatus` for the two statuses plus `by_paymentStatus_and_fulfillmentStatus_and_cancelledAt` eq `disputed`; `done` → `by_fulfillmentStatus` delivered plus payment reads for `refunded` and `partially_refunded`, all through `newestFirst(lists, limit)`. In `getAllOrdersAdmin`, drop `paymentMethod`, add `since: v.optional(v.number())`, and after `matchesDeskFilter` apply `.filter((o) => args.since === undefined || o.createdAt >= args.since)`.

- [ ] **Step 5: Update the convex-test callers**

`statusSplit.test.ts:246` → `list("needs_packing")`; add in the same test: `expect(await list("needs_attention")).toEqual(["GL-DESK-PAID", "GL-DESK-PARTIAL"])` (legacy id), `expect(await list("shipped")).toEqual([])`, `expect(await list("problems")).toEqual([])`, `expect(await list("done")).toEqual(["GL-DESK-SHIPPED"])` (delivered and refunded, counted once; the cancelled order is excluded). `returnContracts.test.ts`: add `expect(await admin.query(api.orders.desk.getAllOrdersAdmin, { clientTime: NOW, since: NOW - DAY })).toHaveLength(1)` next to the existing lines (the seed has one order at `NOW` and one at `NOW - 2 * DAY`; confirm by reading `seeded()`).

- [ ] **Step 6: `src/lib/orderStatus.ts`** — `ADMIN_DESK_TABS` to the new id list (same order as `DESK_FILTERS`); its test keeps passing.

- [ ] **Step 7: Run and type check**

Run: `bunx vitest run convex/orders src/lib/orderStatus.test.ts && bunx tsc --noEmit -p convex && bunx tsc --noEmit`
Expected: PASS; the app tsc will flag `orders/page.tsx` for `paymentMethod` and `needs_attention` — fix those two references minimally there (they are deleted in Task 4 anyway) so the gate is green.

- [ ] **Step 8: Commit**

```bash
git add convex/orders src/lib/orderStatus.ts "src/app/[locale]/admin/orders/page.tsx"
git commit -m "feat(orders): desk queues shipped/problems/done, needs_packing id, since bound"
```

### Task 2: `orderFilters.ts`

**Files:**
- Create: `src/lib/admin/orderFilters.ts`, `src/lib/admin/orderFilters.test.ts`
- Delete: `src/lib/admin/queueParam.ts`, `src/lib/admin/queueParam.test.ts`

**Interfaces:**
```ts
export const QUEUES = ["needs_packing","overdue","awaiting_payment","shipped","problems","done","all"] as const;
export type Queue = (typeof QUEUES)[number];
export const RANGES = ["today","7d","30d","all"] as const;
export type Range = (typeof RANGES)[number];
export type OrderFilters = { queue: Queue; range: Range; q: string };
export const DEFAULT_ORDER_FILTERS: OrderFilters = { queue: "all", range: "30d", q: "" };
export function filtersFromSearchParams(sp: URLSearchParams): OrderFilters;   // junk → defaults
export function filtersToSearchParams(f: OrderFilters): URLSearchParams;      // defaults omitted
export function hasActiveFilters(f: OrderFilters): boolean;
export function sinceFor(range: Range, now: number, tzOffsetMinutes: number): number | undefined;
// today = local midnight (now shifted by tzOffsetMinutes, floored to the UTC day, shifted back); 7d = now - 7*DAY; 30d = now - 30*DAY; all = undefined
export const ORDERS_LIMIT = 250;
```

- [ ] **Step 1: Write the tests**

`"round-trips every field through the URL"` (`{queue:"overdue",range:"7d",q:"ana"}` → `queue=overdue&range=7d&q=ana` → back); `"omits defaults"` (`DEFAULT_ORDER_FILTERS` → `""`); `"falls back on junk"` (`?queue=junk&range=junk` → defaults, `q` kept); `"today is local midnight"`: `now = Date.UTC(2026, 9, 17, 3)` (23:00 Oct 16 New York), `tz = 240` → `sinceFor("today", now, 240) === Date.UTC(2026, 9, 16, 4)`; `"7d and 30d are plain offsets, all is open"`; `"hasActiveFilters is false only at defaults"`.

- [ ] **Step 2: RED** — `bunx vitest run src/lib/admin/orderFilters.test.ts`, module not found.

- [ ] **Step 3: Implement; delete `queueParam.ts` and its test.**

- [ ] **Step 4: GREEN** — `bunx vitest run src/lib/admin` PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/admin/orderFilters.ts src/lib/admin/orderFilters.test.ts
git rm -q src/lib/admin/queueParam.ts src/lib/admin/queueParam.test.ts
git commit -m "feat(admin): order queue, range and search filters in the URL"
```

### Task 3: `orderRow.ts`

**Files:**
- Create: `src/lib/admin/orderRow.ts`, `src/lib/admin/orderRow.test.ts`

**Interfaces:**
```ts
export type OrderRowInput = {
  _id: string; orderNumber: string; customerName?: string; customerEmail?: string; total: number; createdAt: number;
  paymentStatus: PaymentStatus; fulfillmentStatus: FulfillmentStatus; cancelledAt?: number;
  items: Array<{ name: string; image: string; quantity: number }>;
  shippingAddress?: { line1: string };
};
export type OrderRowVM = {
  id: string; orderNumber: string; href: string;              // href = `/admin/orders/${orderNumber}`
  customer: string;                                          // name, else email, else "" (component shows admin.orders.guest)
  totalLabel: string;                                        // formatUsd from homeView.ts
  itemCount: number; thumbs: string[];                       // sum of quantities; first 3 non-empty images
  lifecycle: { paymentStatus; fulfillmentStatus; cancelledAt? };   // for OrderStatusPills
  age: { value: number; unit: "m" | "h" | "d" }; overdue: boolean; // overdue = awaitsPacking && createdAt < now - DAY
  quickAction: "buy" | "reship" | null; addressMissing: boolean;
};
export function toOrderRow(order: OrderRowInput, now: number, locale: "en" | "es"): OrderRowVM;
```
`quickAction` comes from `labelAction` in `convex/orders/status.ts` (import via `../../../convex/orders/status`; it is pure). Age: `< 60 min` → minutes, `< 24 h` → hours, else days, floored, minimum `0m`.

- [ ] **Step 1: Tests**: `"links to the detail page"`; `"prefers name, then email"`; `"sums quantities and keeps three thumbs"`; `"age in m/h/d"` (`now - 5*MIN` → `{5,"m"}`, `now - 3*HOUR` → `{3,"h"}`, `now - 2*DAY` → `{2,"d"}`); `"overdue flips only after 24 h"` (`now - DAY` false, `now - DAY - 1` true, and false for an awaiting-payment order however old); `"quick action follows labelAction"` (paid+unfulfilled → `"buy"`, paid+delivery_exception → `"reship"`, awaiting_payment → `null`, cancelled → `null`); `"addressMissing when no line1"`.

- [ ] **Step 2: RED** — module not found. **Step 3: Implement.** **Step 4: GREEN** — `bunx vitest run src/lib/admin/orderRow.test.ts`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/admin/orderRow.ts src/lib/admin/orderRow.test.ts
git commit -m "feat(admin): order row view model"
```

### Task 4: Components and the page

**Files:**
- Create: `src/components/admin/orders/useOrderFilters.ts`, `OrdersList.tsx`, `QueueChips.tsx`, `RangeChips.tsx`, `OrderRow.tsx`, `OrdersSkeleton.tsx`
- Replace: `src/app/[locale]/admin/orders/page.tsx` (renders `<Suspense fallback={<OrdersSkeleton />}><OrdersList /></Suspense>`; ~15 lines)
- Add to `src/lib/admin/orderFilters.ts`: `export function legacyOrderParamHref(sp: URLSearchParams): string | null` — for `?order=1042` / `#1042` / `GL-1042` / `MC-1042` returns `/admin/orders/<UPPER, with GL- prefix when none>`; else `null`. Test in `orderFilters.test.ts`.

**Interfaces:**
- `useOrderFilters()` mirrors `useProductFilters` (state first, then `router.replace`), returns `{ filters, setFilters, clear }`.
- `OrdersList`: `useMinuteClock()` → `clientTime`; `tzOffsetMinutes` from the browser; on mount, if `legacyOrderParamHref` returns a path, `router.replace` to it and render nothing else. Query `api.orders.desk.getAllOrdersAdmin({ clientTime, status: filters.queue, search: filters.q, since: sinceFor(filters.range, clientTime, tz), limit: ORDERS_LIMIT })`; `getOrdersAttentionStats({ clientTime })` for chip counts (Needs packing, Overdue). Header: `h1` `admin.orders.title`; search input with `/` shortcut via `useAdminShortcuts` (from `products/useAdminShortcuts`); `QueueChips`; `RangeChips`; the list; `admin.common.showingLatest` when `orders.length === ORDERS_LIMIT`; `EmptyState` with `admin.orders.empty` + Clear filters when 0 rows; `QueryErrorBoundary` retry panel. `ShippingLabelModal` mounted once with `order` state and `reship` flag; its `onSuccess(message)` sets a success line (`role="status"`, emerald, dismiss ×) above the list for 4 s (`FeedbackBanner` is Products-specific; do not reuse it).
- `OrderRow`: a `Link` card (phone and desktop; max width `3xl`): first line order number (mono, bold) + age (`admin.orders.age.{m,h,d}` with `{count}`; `text-rose-500` when overdue) + `OrderStatusPills`; second line customer · total · `admin.orders.items` `{count}` + thumbs (`next/image` 28 px, overlapping); when `quickAction`, a button on the right (`admin.orders.buyLabel` / `admin.orders.reship`; amber outline when `addressMissing`) that calls `onQuickAction(row)` with `e.preventDefault()` so the card link does not fire.
- `QueueChips`: seven chips from `QUEUES`, labels `admin.orders.queue.*`, counts for `needs_packing` and `overdue` from attention stats; overdue chip rose when its count > 0. `RangeChips`: four chips, `admin.orders.range.*`.
- Copy: rewrite `admin.orders` in both locales to exactly: `title`, `searchPlaceholder`, `guest`, `items` (plural), `age.m|h|d` (`{count}m` style), `buyLabel`, `reship`, `addressAndLabel`, `queue.{needs_packing,overdue,awaiting_payment,shipped,problems,done,all}`, `range.{today,7d,30d,all}`, `empty`, `clearFilters`, `labelBought`. Remove every other `admin.orders.*` key (the detail page uses none; verify with `grep -rn 'admin.orders' src`).

- [ ] **Step 1: `legacyOrderParamHref` test + implementation** (RED → GREEN in `orderFilters.test.ts`).
- [ ] **Step 2: Build the hook, components and page; delete the old page body.**
- [ ] **Step 3: Copy in both locales; parity check** (the `bun -e` one-liner from plan 0009a Task 9).
- [ ] **Step 4: Gates** — `bun run test && bunx tsc --noEmit && bunx tsc --noEmit -p convex`, PASS; `grep -rn "getWhatsAppAdminCustomerUrl\|whatsapp" "src/app/[locale]/admin/orders/page.tsx" src/components/admin/orders` → no output.
- [ ] **Step 5: Preview** at phone and desktop, EN and ES: `/admin/orders` defaults to 30d; `?queue=needs_packing` from Home selects the chip; `?order=GL-xxxx` redirects to the detail page; a row tap opens the detail page; Buy label opens the modal; search `/` focuses; `?queue=all&range=all` shows the 250 note only when at the cap.
- [ ] **Step 6: Commit**

```bash
git add src/components/admin/orders "src/app/[locale]/admin/orders/page.tsx" src/lib/admin/orderFilters.ts src/lib/admin/orderFilters.test.ts src/messages
git commit -m "feat(admin): Orders list as queue cards; drawer and WhatsApp removed"
```
