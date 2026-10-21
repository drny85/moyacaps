# Admin Operations Redesign — Design Spec

**Status:** Design settled (grilling session, 2026-10-21). Not implemented.
**Depends on:** plan 0005 (Products redesign, merged 2026-10-19) as the standard to match; ADR 0023 (WhatsApp concierge removed); ADR 0024 (Payment Status / Fulfillment Status split); ADR 0025 (refund ledger).
**Scope:** The admin shell and the Orders, Home (formerly Analytics), Settings and Drops screens: `src/app/[locale]/admin/**` except `products/`, `src/components/admin/**` except `products/`, `src/lib/admin/**`, `src/messages/{en,es}.json`. Backend changes only where listed under "Backend gaps".

**Goal:** Bring Orders, Drops and Analytics up to the Products standard: one implementation per screen, phone-first, every decision in a tested pure module, every string in both locales, no dead WhatsApp surfaces, no dev tooling in the UI.

Domain terms follow `CONTEXT.md`: Order, Payment Status, Fulfillment Status, Needs Packing, Drop, Tracking Number, Reship, Delivery Exception, Available Inventory, Administrator, High-Friction Confirmation Safeguard. "Needs attention" is a Product term only (plan 0005 D13).

---

## Today

Products (`src/components/admin/products/**`) is the new standard: card grid, full-page editor, pure modules under `src/lib/admin/` with colocated Vitest tests, keyboard shortcuts, copy in both locales, loading/empty/error/stale states. The other screens predate it:

| Screen | Lines | `any` | Pure modules / tests | Copy |
|---|---|---|---|---|
| `admin/orders/page.tsx` | 1660 | 14 | none | mixed hardcoded English |
| `admin/orders/[orderNumber]/page.tsx` | 1369 | 10 | none | mixed |
| `admin/drops/page.tsx` | 1097 | 5 | none | partly hardcoded |
| `admin/analytics/page.tsx` | 516 | 1 | none | hardcoded |

Functional problems:

1. **Orders is implemented twice.** The list page has a slide-over drawer with dispatch / deliver / revert / cancel / edit-address handlers; the detail page re-implements the same five plus notes and labels. The drawer holds a frozen copy of the order and needs a "self-heal" effect to re-sync with live data. Two code paths for irreversible actions.
2. **WhatsApp concierge is dead (ADR 0023) but still on screen**: Analytics channel split "Stripe vs WhatsApp Concierge"; Orders payment filter `WhatsApp (legacy)`; "Dispatch and notify via WhatsApp"; `convex/analytics/model.ts` still buckets `paymentMethod === "whatsapp"`.
3. **Analytics is really Home + Settings.** `StoreSettingsCard` (shipping rules) lives on the Analytics page; there is no Settings nav entry. The chart is a fixed 7-day window. The low-stock card and its `+10` quick restock call `adjustVariantStock`, which is caps-only, so tee SKUs never appear. Copy says "Colorways" everywhere.
4. **Dev tooling in the production UI**: "Send test alert via Resend" on Orders; a "Convex Reactive" pulse in the sidebar.
5. **Orders list**: 12 status pills, server filter capped at 250 rows, no date range, no sort.
6. **Admin chrome is English-only** regardless of locale ("Operations HQ", "Operations Desk", "Live Channels", "STAFF").
7. **Three low-stock thresholds**: `LOW_STOCK_THRESHOLD = 5` (Products), `ANALYTICS_LOW_STOCK_UNITS = 5`, `ATTENTION_LOW_STOCK_UNITS = 2` (sidebar badge).
8. **Terminology**: the Orders tab id `needs_attention` is labelled "Needs packing" while Products uses "Needs attention" for image/stock problems. One id, two meanings. `CONTEXT.md` had no Drop entry.

---

## Decisions

| # | Decision |
|---|----------|
| D1 | **Deliverable and shape.** This spec; four PRs (D25). Each PR replaces a screen whole; old screens stay until their PR lands. |
| D2 | **Devices.** One Administrator. Orders and Drops are designed phone-first (packing happens with a phone in hand); Home is designed desktop-first. Both widths are first-class everywhere. |
| D3 | **Order of work.** Shell + Home + Settings first (every later PR builds on the nav and i18n keys), then Orders list, then Order detail, then Drops. |
| D4 | **The Products rule applies to every screen.** Every decision (filters, queues, view models, next action, countdown, CSV rows) lives in a pure module under `src/lib/admin/` with a colocated Vitest test; components render view models and call hooks; zero `any`; every string under `admin.*` in `en.json` and `es.json`. Route files stay under ~50 lines. |
| D5 | **WhatsApp is gone from the admin.** Remove the analytics channel split, the `WhatsApp (legacy)` payment filter, the "notify via WhatsApp" dispatch option, `getWhatsAppAdminCustomerUrl` imports in admin, and the `whatsapp` bucket in `convex/analytics/model.ts`. Old orders with `paymentMethod: "whatsapp"` still count as revenue; there is no channel breakdown anymore. The Customer-facing WhatsApp Support Chat link is unrelated and stays. |
| D6 | **One order surface.** The drawer is deleted. A row tap goes to `/[locale]/admin/orders/[orderNumber]` (linkable, back-button safe, no frozen snapshot). `?order=` auto-open is removed; admin alert emails already link to the detail page. |
| D7 | **Home replaces Analytics; Settings is its own page.** Home at `/admin` (no redirect page). `/admin/analytics` redirects to `/admin`. New `/admin/settings`. Storefront links that point at `/admin/analytics` (`Navbar.tsx`, `MobileActionBar.tsx`, `account/orders/page.tsx`, `AdminQuickBar.tsx`) point at `/admin`. |
| D8 | **Dev tools out of the UI.** "Send test alert" moves to `scripts/send-test-admin-alert.ts` (same shape as `scripts/set-admin.ts`, calling `api.notifications.emails.sendTestAdminOrderAlert`). The "Convex Reactive" indicator is removed. |
| D9 | **Glossary.** `CONTEXT.md` gains **Drop** and **Needs Packing** (written 2026-10-21). The desk filter id `needs_attention` becomes `needs_packing` (`convex/orders/deskFilters.ts` keeps `needs_attention` in `LEGACY_FILTERS`). |
| D10 | **Orders list row (phone card).** Order number; customer name; Payment Status and Fulfillment Status pills (`OrderStatusPills`); total; item count with up to 3 thumbnails; age ("2h", red past 24h). One quick action: **Buy label** or **Reship**, shown when `labelAction(order)` allows it, opening the existing `ShippingLabelModal`. Nothing else on the row. |
| D11 | **Queues, not statuses.** Seven queue chips: **Needs packing · Overdue · Awaiting payment · Shipped · Problems · Done · All**. Shipped = `label_purchased` + `in_transit`; Problems = `delivery_exception` + `returned` + `disputed`; Done = `delivered` + `refunded` + `partially_refunded` (and `cancelled` under All only). Plus search (order number, name, email, Tracking Number) and a range chip row **Today · 7d · 30d · All**. Queue, range and search sync to URL params (`?queue=&range=&q=`). The payment-method filter is removed (D5). |
| D12 | **Overdue = Needs Packing for more than 24 hours.** No weekend rule. Unchanged from today. |
| D13 | **Order detail layout.** Phone, one column, in this order: status header (both pills, age, order number with copy); **Next action** (D14); items; ship-to with edit (when `canEditShippingAddress`); labels and Tracking Number (`LabelHistoryCard`) with a secondary "Add tracking manually" link (D15); refunds (`OrderRefundsPanel`); notes; danger zone (cancel, behind the confirm). Desktop, two columns: items + money left; fulfillment + customer right. |
| D14 | **Next action is computed, never guessed.** `nextOrderAction(order)` in `src/lib/admin/orderActions.ts` returns exactly one of `buy_label`, `reship`, `mark_delivered`, `resolve_exception`, `await_payment`, `none`, derived from `labelAction` and `canChangeFulfillment` in `convex/orders/status.ts`, so the UI never offers a move the server rejects. The button for it is the only primary button on the page. |
| D15 | **Manual tracking entry stays, demoted.** `updateOrderFulfillmentAdmin` (carrier + Tracking Number typed by hand) is reachable from a text link under the labels section, not a primary button. |
| D16 | **Manual fulfillment moves stay, behind the confirm.** **Mark delivered** and **Revert** appear only when `canChangeFulfillment(order)` allows the move, each behind a High-Friction Confirmation Safeguard. Carrier scans remain the normal path. |
| D17 | **Date range is server-side.** `getAllOrdersAdmin` gains `since?: number`. Today / 7d / 30d read `by_createdAt` from `since`; All keeps the 250 cap and the list shows "Showing the latest 250". No pagination until that note is seen in practice. |
| D18 | **Home content**, top to bottom: attention strip (Needs packing N · Overdue N · Problems N · Low stock N, each a link into the matching queue or the Products attention filter); revenue and order tiles for Today / 7d / 30d; a 30-day daily bar chart; low stock list covering Caps and tee SKUs, each row linking to the Product editor; best sellers. No settings, no restock buttons on Home. |
| D19 | **Settings sections**: Shipping (`flatShippingFeeUsd`, `freeShippingThresholdUnits` via `getStoreSettings` / `updateStoreSettings`); Category launch (`CategoryLaunchCard`, moved here from the Products page); Alerts (the current admin alert recipient, read-only, from `ADMIN_NOTIFICATION_EMAIL`; the order chime toggle); Account (locale, theme, user button). The alert email stays in env: moving it into `store_settings` would let any admin session redirect alerts. |
| D20 | **Sidebar**: Home · Orders (badge) · Products · Drops · Settings, labels from `admin.nav.*`. The footer holds only "Storefront ↗" and the user button. "Operations HQ / Operations Desk / Live Channels / STAFF" are removed. The order chime stays (and its toggle moves to Settings → Alerts). |
| D21 | **One low-stock threshold.** `LOW_STOCK_UNITS = 5` exported from `convex/catalog/stock.ts`, used by Home, the sidebar badge, `src/lib/admin/stockLevel.ts` and `productFilters.ts`. `ATTENTION_LOW_STOCK_UNITS` (2) is deleted. |
| D22 | **Drops is a consistency pass.** Two sections stay: **Active drops** (cards: Catalog Shot, Product name, scheduled time, countdown, subscriber count, actions Postpone / Release now / Cancel) and **Subscribers** (table filterable by Product, CSV export named `good-luck-drop-subscribers-YYYY-MM-DD.csv`). The five modals collapse into the existing `DropScheduleDialog` (schedule, postpone, edit badge) plus one `ConfirmDialog` (release now, cancel, delete). Delete stays behind the confirm and keeps the `deleteSubscribers` choice. |
| D23 | **Admin bar on the storefront.** `AdminQuickBar` renders minimized by default (the small "Admin" pill) and links to `/admin`. The expanded state is opt-in per click and not persisted. |
| D24 | **Keyboard** (D11 of plan 0005 carried over): `/` focuses search on Orders and Drops; `Esc` returns from Order detail to the list; `⌘S`/`Ctrl+S` saves notes or address when their form is open. |
| D25 | **PRs, in order:** (1) shell + Home + Settings + WhatsApp removal + threshold + glossary id rename; (2) Orders list; (3) Order detail + drawer removal; (4) Drops. |

Out of scope: pagination, bulk order actions, customers page, analytics beyond 30 days, exporting orders, push notifications. No ADR: nothing here is hard to reverse, and ADR 0023/0024 already explain the surprising parts.

---

## Screens

### 1. Shell (`AdminConsoleLayout`)

```
┌ sidebar (md+) ──────────┐ ┌ main ──────────────────────────────┐
│ ◉ GOOD LUCK             │ │                                    │
│ Home                    │ │   <page>                           │
│ Orders            (3)   │ │                                    │
│ Products                │ │                                    │
│ Drops                   │ │                                    │
│ Settings                │ │                                    │
│ ───────────────────     │ │                                    │
│ Storefront ↗      (👤)  │ │                                    │
└─────────────────────────┘ └────────────────────────────────────┘
```

Phone: sticky top bar (menu, brand, user button); the menu opens the same five links. The Orders badge is `totalActionRequired`; it turns rose when `overduePaid > 0`. Locale and theme switches live in Settings → Account, not in the sidebar.

**Data:** `api.orders.desk.getOrdersAttentionStats({ clientTime })` (unchanged). The chime watcher stays in the layout; its on/off preference stays in `localStorage` under the existing key `moya_admin_sound`.

### 2. Home: `/[locale]/admin`

```
┌ Home ────────────────────────────────────────────────────────────┐
│ [Needs packing 3] [Overdue 1] [Problems 0] [Low stock 2]         │
│ ┌ Today ─────┐ ┌ 7 days ────┐ ┌ 30 days ───┐                    │
│ │ $120 · 2   │ │ $840 · 11  │ │ $3,100 · 39│                    │
│ └────────────┘ └────────────┘ └────────────┘                    │
│ ┌ Revenue, last 30 days ────────────────────────────────────────┐│
│ │ ▁▂▃▁▅▂▁▁▃▇▂▁▁▂▃▁▁▂▁▃▂▁▅▁▁▂▃▁▂▁                                ││
│ └───────────────────────────────────────────────────────────────┘│
│ ┌ Low stock ──────────────────┐ ┌ Best sellers (30d) ──────────┐│
│ │ [img] Gothic Skull · White M │ │ #1 [img] Boxing Gloves  14   ││
│ │       2 left        → Edit   │ │ #2 [img] 0880 Snapback   9   ││
│ └─────────────────────────────┘ └──────────────────────────────┘│
└──────────────────────────────────────────────────────────────────┘
```

Attention links: Needs packing → `/admin/orders?queue=needs_packing`; Overdue → `?queue=overdue`; Problems → `?queue=problems`; Low stock → `/admin/products?stock=low`.

**Data:** `api.analytics.functions.getAnalyticsAdmin({ clientTime })` with the shape changes in Backend gaps 1–3. Loading shows tile and chart skeletons; a query error shows the shared retry panel (`QueryErrorBoundary` from Products, moved to `src/components/admin/`).

### 3. Settings: `/[locale]/admin/settings`

Stacked cards: Shipping, Category launch, Alerts, Account. Shipping and Category launch are the existing `StoreSettingsCard` and `CategoryLaunchCard` with copy moved under `admin.settings.*`. Alerts shows the recipient email from Backend gap 4 and the chime toggle. Account holds the EN/ES switch, `ThemeToggle` and `SafeUserButton`.

### 4. Orders list: `/[locale]/admin/orders`

```
Phone
┌ Orders ──────────────────────────────────────┐
│ [🔍 Order #, name, email, tracking        /] │
│ (Needs packing 3)(Overdue 1)(Awaiting)(Shipped)(Problems)(Done)(All) ⟶ │
│ (Today)(7d)(30d•)(All)                       │
│ ┌──────────────────────────────────────────┐ │
│ │ #GL-1042           2h      [Paid][Unfulfilled] │
│ │ Ana López · $86 · 2 items [▣][▣]         │ │
│ │                        [ Buy label ]     │ │
│ └──────────────────────────────────────────┘ │
│ ┌──────────────────────────────────────────┐ │
│ │ #GL-1041           1d ⚠    [Paid][Label purchased] │
│ │ …                                        │ │
│ └──────────────────────────────────────────┘ │
│ Showing the latest 250                        │
└──────────────────────────────────────────────┘
```

Desktop: the same cards in a single column at ~720 px, or a table with the same fields; either way one component renders one `OrderRowVM`. States: skeleton rows; "No orders in this queue" with Clear filters; retry panel on query error.

**Data:** `api.orders.desk.getAllOrdersAdmin({ clientTime, status: queue, search, since })` (Backend gap 5). Label purchase goes through the existing `ShippingLabelModal`.

### 5. Order detail: `/[locale]/admin/orders/[orderNumber]`

```
Phone
┌ ← Orders                                     ┐
│ #GL-1042  [Paid][Unfulfilled]  2h  ⧉         │
│ ┌ Next: Buy shipping label ────────────────┐ │
│ │ USPS Ground Advantage suggested          │ │
│ │                        [ Buy label ]     │ │
│ └──────────────────────────────────────────┘ │
│ Items (2) ……………………………………… $86.00           │
│ Ship to ………………………………… [Edit]               │
│ Labels & tracking ……………… (none yet)          │
│   Add tracking manually                      │
│ Refunds ………………………………… (ledger)              │
│ Notes ……………………………………… [Save ⌘S]             │
│ ▸ Cancel order                               │
└──────────────────────────────────────────────┘
```

The Next card's body depends on `nextOrderAction`: `buy_label`/`reship` → `ShippingLabelModal`; `mark_delivered` → confirm then `updateFulfillmentStatusAdmin({ fulfillmentStatus: "delivered" })`; `resolve_exception` → Reship (label modal) or Refund (refunds panel); `await_payment` → "Waiting for payment, hold expires at …", no button; `none` → the card is hidden. "Order not found" shows a back link.

**Data:** `getOrderDetailAdmin({ orderNumber })`; `updateShippingAddressAdmin`; `updateFulfillmentStatusAdmin`; `updateOrderFulfillmentAdmin` (manual tracking, notes); `api.payments.refunds.cancelAndRefundOrderAdmin`; `OrderRefundsPanel` and `LabelHistoryCard` unchanged.

### 6. Drops: `/[locale]/admin/drops`

Section 1, Active drops: a card per scheduled or live Drop. Section 2, Subscribers: a Product select, the table, and Export CSV. "No drops scheduled" links to Products with a hint that scheduling starts from a Product card's ⋯ menu.

**Data:** `getAllDropsAdmin({ clientTime })`, `getDropSubscribersList({ variantId? })`, `scheduleDrop`, `postponeDrop`, `releaseDropNow`, `cancelDrop`, `deleteDrop` — all unchanged.

---

## Component breakdown

Pure modules live in `src/lib/admin/`, are framework-free, use relative imports and are tested with Vitest.

### Pure view-model helpers (each with `*.test.ts`)

| Module | Exports | Key tests |
|--------|---------|-----------|
| `orderQueues.ts` | `type Queue = "needs_packing"\|"overdue"\|"awaiting_payment"\|"shipped"\|"problems"\|"done"\|"all"`; `QUEUES`; `deskFiltersForQueue(q): DeskFilter[]`; `queueOf(order, now): Queue` | Each status lands in exactly one queue; cancelled only under `all`; overdue needs 24h. |
| `orderFilters.ts` | `type OrderFilters = { queue; range: "today"\|"7d"\|"30d"\|"all"; q }`; `EMPTY_ORDER_FILTERS`; `filtersFromSearchParams(sp)`; `filtersToSearchParams(f)`; `sinceFor(range, now)`; `hasActiveFilters(f)` | URL round trip; junk params fall back to defaults; `sinceFor("today")` is local midnight. |
| `orderRow.ts` | `toOrderRow(order, locale, now): OrderRowVM` with `{ id, orderNumber, customer, totalLabel, itemCount, thumbs, payment, fulfillment, ageLabel, overdue, quickAction?: "buy"\|"reship" }` | Age formatting en/es; overdue flag at 24h; quick action follows `labelAction`. |
| `orderActions.ts` | `nextOrderAction(order): NextAction`; `allowedManualMoves(order): ("mark_delivered"\|"revert")[]` | One action per status combination; never offers a move `canChangeFulfillment` forbids; disputed orders get `none`. |
| `orderDetail.ts` | `toOrderDetail(order, locale): OrderDetailVM` (sections: header, items, money, shipTo, labels, notes, danger) | Money sums match `subtotal + shippingFee + tax`; address editable flag follows `canEditShippingAddress`. |
| `homeView.ts` | `toHomeVM(analytics, locale): HomeVM` (attention strip, tiles, chart bars, low stock rows, best sellers) | Tiles for today/7d/30d from daily buckets; chart max; tee SKU rows named "Design · Colorway Size". |
| `dropCard.ts` | `toDropCard(row, locale, now): DropCardVM`; `countdown(target, now): { d,h,m,s,past }` | Past target gives `past: true`; en/es date labels. |
| `subscribersCsv.ts` | `toCsvRows(subscribers): string[][]`; `csvFilename(now)` | Escapes commas/quotes; filename date. |
| `stockLevel.ts` (existing) | now imports `LOW_STOCK_UNITS` | unchanged tests pass. |

### Hooks (`src/components/admin/orders/`, `.../home/`, `.../drops/`)

- `useOrderFilters()`: reads and writes `OrderFilters` through `useSearchParams`/`router.replace`.
- `useOrderDetail(orderNumber)`: wraps the query and the five mutations/actions; exposes `vm`, `nextAction`, `runNextAction`, `saveNotes`, `saveAddress`, `markDelivered`, `revert`, `cancel`, plus `error`/`busy`.
- `useAdminShortcuts` (existing, from Products) is reused.

### Components

| Component | Replaces | Notes |
|-----------|----------|-------|
| `AdminConsoleLayout.tsx` | same | Five nav items; footer shrinks to Storefront + user button. |
| `ConfirmDialog.tsx` | the per-screen inline modals | One High-Friction Confirmation Safeguard component: title, body, destructive flag, busy state. `StockConfirmDialog` etc. stay for their own cases. |
| `QueryErrorBoundary.tsx` | `products/QueryErrorBoundary.tsx` | Moved up one level, shared. |
| `home/HomePage.tsx`, `AttentionStrip.tsx`, `RevenueTiles.tsx`, `RevenueChart.tsx`, `LowStockList.tsx`, `BestSellers.tsx` | `analytics/page.tsx` | Render `HomeVM`. |
| `settings/SettingsPage.tsx`, `AlertsCard.tsx`, `AccountCard.tsx` | — | `StoreSettingsCard`, `CategoryLaunchCard` reused. |
| `orders/OrdersList.tsx`, `QueueChips.tsx`, `RangeChips.tsx`, `OrderRow.tsx`, `OrdersSkeleton.tsx` | `orders/page.tsx` | Drawer deleted. |
| `orders/OrderDetailPage.tsx`, `NextActionCard.tsx`, `ItemsSection.tsx`, `ShipToSection.tsx`, `LabelsSection.tsx`, `NotesSection.tsx`, `DangerZone.tsx`, `AddressDialog.tsx`, `ManualTrackingDialog.tsx` | `orders/[orderNumber]/page.tsx` | `OrderRefundsPanel`, `LabelHistoryCard`, `ShippingLabelModal`, `OrderStatusPills`, `RefundDialog` reused. |
| `drops/DropsPage.tsx`, `DropCard.tsx`, `SubscribersTable.tsx` | `drops/page.tsx` | `DropScheduleDialog`, `DateTimePicker` reused. |
| `AdminQuickBar.tsx` | same | Minimized by default. |

Routes: each `page.tsx` renders one component under `Suspense` where it reads `useSearchParams`. `admin/page.tsx` renders `HomePage`; `admin/analytics/page.tsx` becomes a redirect to `/[locale]/admin`.

Copy: `admin.nav.*` (`home`, `orders`, `products`, `drops`, `settings`), `admin.home.*`, `admin.settings.*`, `admin.orders.*` (rewritten: queues, ranges, row, detail, next action, dialogs), `admin.drops.*`, `admin.common.*` (confirm, cancel, save, retry, showingLatest). Remove `admin.orders.pingWhatsApp`, `dispatchAndNotify`, `filterPayment`, `allPayments` and `admin.metrics.*` entries no longer used.

---

## Backend gaps

1. **Analytics window and buckets.** `computeAnalytics` emits 7 daily buckets. Change to 30 (`dailySales` length 30) and add `windows: { today, d7, d30 }` each `{ revenue, orders }`, computed from the same buckets. `ANALYTICS_ORDER_WINDOW` (2000) stays. Test: an order at 23:59 local lands in "today", not tomorrow (buckets use the caller's `clientTime` minus a fixed offset argument `tzOffsetMinutes`, new, since the server has no local day).
2. **Low stock covers tee SKUs.** `lowStockVariants` becomes `lowStock: Array<{ variantId; label; colorway?; size?; stock; image }>`: for caps the variant stock, for tees each `skus` row with `stock <= LOW_STOCK_UNITS`. Reads `skus` through `by_variantId_and_colorway_and_size` (prefix on `variantId`) for tee variants only.
3. **WhatsApp bucket removed.** `paymentBreakdown` is deleted from `analyticsValidator` and `computeAnalytics`; `convex/analytics/model.test.ts` cases for it go. Revenue counting keeps `countsAsSale(order)` regardless of `paymentMethod`.
4. **Alert recipient for Settings.** New `api.notifications.emails.getAdminRecipient` query (admin-only) returning `resolveAdminRecipient(process.env.ADMIN_NOTIFICATION_EMAIL, primaryAdminEmail)`; read-only, so Settings can show where alerts go and whether it fell back.
5. **Orders date range.** `getAllOrdersAdmin` gains `since?: number`. When set, `readDeskFilter` reads `by_createdAt` with `q.gte("createdAt", since)` before status filtering (bounded by the same `maxItems`). `deskFilters.ts`: rename `needs_attention` → `needs_packing`, map the old id in `LEGACY_FILTERS`, add `shipped`, `problems`, `done` as composite filters so the queue is one server call.
6. **One threshold.** `convex/catalog/stock.ts` exports `LOW_STOCK_UNITS = 5`; `convex/analytics/model.ts` and `getOrdersAttentionStats` use it; `ATTENTION_LOW_STOCK_UNITS` is deleted. The sidebar badge's `lowStockCount` changes meaning from "≤ 2" to "≤ 5"; intended.

Each gap is a small change with a convex-test case. Gaps 1–4 and 6 land in PR 1; gap 5 in PR 2.

---

## Implementation order

**PR 1 — shell, Home, Settings** (`feat/admin-shell-home-settings`)
1. `convex/catalog/stock.ts` + gap 6; gaps 1–4 with tests.
2. `homeView.ts` + tests; Home components; `admin/page.tsx` renders Home; `/admin/analytics` redirects.
3. Settings page; move `CategoryLaunchCard` off the Products page; `StoreSettingsCard` copy under `admin.settings.*`.
4. `AdminConsoleLayout`: five nav items, footer, no "Convex Reactive"; `AdminQuickBar` minimized; repoint the five `/admin/analytics` links.
5. `scripts/send-test-admin-alert.ts`; remove the button from Orders.
6. Copy in both locales. Verify in preview: phone and desktop, dark and light, ES locale shows no English chrome.

**PR 2 — Orders list** (`feat/admin-orders-list`)
1. Gap 5 with tests. `orderQueues.ts`, `orderFilters.ts`, `orderRow.ts` + tests.
2. `OrdersList`, `QueueChips`, `RangeChips`, `OrderRow`; the page renders it; drawer code deleted along with the WhatsApp dispatch option (the detail page still serves actions until PR 3).
3. Verify: queue counts match the sidebar badge; `?queue=overdue&range=7d` survives reload; Buy label from a row; 250-cap note on All.

**PR 3 — Order detail** (`feat/admin-order-detail`)
1. `orderActions.ts`, `orderDetail.ts` + tests. `ConfirmDialog`.
2. `OrderDetailPage` and sections; `useOrderDetail`; old page body deleted.
3. Verify: each `nextOrderAction` branch on a seeded order; Mark delivered and Revert only when allowed; address edit blocked after label purchase; `Esc` back; `⌘S` on notes.

**PR 4 — Drops** (`feat/admin-drops-pass`)
1. `dropCard.ts`, `subscribersCsv.ts` + tests.
2. `DropsPage`, `DropCard`, `SubscribersTable`; five modals → `DropScheduleDialog` + `ConfirmDialog`.
3. Verify: schedule → postpone → release now on one Product; CSV opens in Numbers with escaped names; delete with and without subscribers.

Gates before every commit: `bun run test`, `bunx tsc --noEmit`, `bunx tsc --noEmit -p convex`. No migrations, no `convex run`, no production deploy from these PRs (Convex prod deploys are manual).
