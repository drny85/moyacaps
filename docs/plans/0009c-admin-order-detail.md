# Admin Order Detail Implementation Plan (plan 0009, PR 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 1369-line order detail page with a phone-first page whose one primary button is the computed next action, whose items are built for packing (Catalog Shot, Colorway / size, big quantity, a Packing sheet on tap), and whose every decision is a tested pure function.

**Architecture:** Two pure modules: `src/lib/admin/orderActions.ts` derives the next action and the allowed manual moves from `convex/orders/status.ts`; `src/lib/admin/orderDetail.ts` builds the page view model, joining order lines to admin product rows for packing images and options. One hook `useOrderDetail` wraps the existing query, mutations and action. Thin section components under `src/components/admin/orders/detail/` render the view model; a shared `ConfirmDialog` is the High-Friction Confirmation Safeguard for every irreversible move. `OrderRefundsPanel`, `LabelHistoryCard`, `ShippingLabelModal`, `RefundDialog`, `OrderStatusPills` and `AdminModal` are reused unchanged. The print-only packing slip is kept, fed from the view model. The page drops every `any`, every WhatsApp surface and every hardcoded string.

**Tech Stack:** Next.js 16 App Router, React 19, Convex, next-intl, Tailwind, Vitest, Bun.

**Spec:** `docs/plans/0009-admin-ops-redesign.md` (D5, D6, D13, D13a, D14–D16, D24; Screen 5). **Branch:** `feat/admin-order-detail`, stacked on `feat/admin-orders-list` (PR 2), which it needs for `admin.common.*`, `QueryErrorBoundary`, the list's back link target and `orderRow`'s `orderAge`.

## Global Constraints

- Scope: `src/lib/admin/{orderActions,orderDetail}.ts` (+tests), `src/components/admin/ConfirmDialog.tsx` (new, shared), `src/components/admin/orders/detail/**` (new), `src/app/[locale]/admin/orders/[orderNumber]/page.tsx` (replaced, ~15 lines), `src/messages/{en,es}.json` (`admin.orderDetail.*` new, `admin.common.*` extended). No Convex changes: `getOrderDetailAdmin`, `updateFulfillmentStatusAdmin`, `updateOrderFulfillmentAdmin`, `updateShippingAddressAdmin`, `cancelAndRefundOrderAdmin` and `getAllProductsAdmin` are used as they are.
- Pure modules in `src/lib/admin/` use relative imports; `labelAction`, `canChangeFulfillment`, `canEditShippingAddress`, `statusAxes` come from `../../../convex/orders/status` (pure); `carrierTrackingNumber` from `../../../convex/orders/trackingNumber`.
- Next action kinds: `buy_label · resolve_exception · mark_delivered · await_payment · none`. Exactly one per Order. `resolve_exception` offers Reship (when `labelAction(order).action === "reship"`) and a link to the refunds panel. The spec's separate `reship` kind is folded into `resolve_exception`.
- Manual moves: `mark_delivered` when `canChangeFulfillment` and Fulfillment Status is `label_purchased`, `in_transit` or `delivery_exception`; `revert` (to `in_transit`) when it is `delivered`. Each behind `ConfirmDialog`.
- Packing data: `getAllProductsAdmin({})` rows joined on `variantId`. A tee line's image is its Apparel Colorway's `catalogShot` (else `lifestyleImage`, else the line's stored image); a cap line's is the row's `catalogShot` (else `image`, else the stored image). A line whose row is missing (archived, deleted) shows the stored name and image and `archived: true`.
- Keyboard: `Esc` → `/admin/orders` (ignored while a dialog is open; `useAdminShortcuts` already does that); `⌘S`/`Ctrl+S` saves the notes or address form when open.
- Zero `any`, no `getWhatsAppAdminCustomerUrl`, all copy under `admin.orderDetail.*` in both locales, domain terms (Catalog Shot, Lifestyle Shot, Apparel Colorway, SKU, Needs Packing, Reship, Tracking Number).
- Gates before every commit: `bun run test`, `bunx tsc --noEmit`, `bunx tsc --noEmit -p convex`.

## Review Focus

1. A paid, unfulfilled, **disputed** Order must get `none` with a reason the page shows (labels are blocked), not `buy_label`. → Task 1 test.
2. A line for a tee whose Colorway was removed from the Product since the order must still render with the stored image, not crash on `colorways.find`. → Task 2 test "colorway no longer on the product".
3. Address edit must disappear the moment a label exists, even if the page was open when the label was bought (reactive). → Task 2 `shipTo.editable` follows `canEditShippingAddress`; Task 3 preview check.
4. `⌘S` with no form open must do nothing, and `Esc` while the Packing sheet is open must close the sheet, not leave the page. → Task 3 preview check; `useAdminShortcuts` dialog guard covers Esc.
5. Cancelling a paid Order defaults to "refund on Stripe" only when `stripeSessionId` exists; otherwise the toggle is hidden and the reason is stored as notes. → Task 2 `danger.refundable` test.

---

### Task 1: `orderActions.ts`

**Files:**
- Create: `src/lib/admin/orderActions.ts`, `src/lib/admin/orderActions.test.ts`

**Interfaces:**
```ts
import type { StatusSource } from "../../../convex/orders/status";
export type NextAction =
  | { kind: "buy_label"; addressMissing: boolean }
  | { kind: "resolve_exception"; reship: boolean }        // reship = labelAction allows a new label
  | { kind: "mark_delivered" }
  | { kind: "await_payment"; holdExpiresAt?: number }
  | { kind: "none"; reason?: string };                    // reason = labelAction's error for paid+unfulfilled Orders that cannot get a label
export function nextOrderAction(order: StatusSource & { shippingAddress?: { line1: string }; checkoutHoldExpiresAt?: number }): NextAction;
export type ManualMove = "mark_delivered" | "revert";
export function allowedManualMoves(order: StatusSource): ManualMove[];
```

- [ ] **Step 1: Tests** (`order(payment, fulfillment, extra)` helper as in `deskFilters.test.ts`): `"cancelled → none"`; `"awaiting payment → await_payment with the hold expiry"`; `"paid unfulfilled → buy_label, flagging a missing address"`; `"disputed unfulfilled → none with the label reason"` (reason matches `/disputed/`); `"label purchased or in transit → mark_delivered"`; `"delivery exception or returned → resolve_exception, reship true"`; `"refunded return → resolve_exception, reship false"`; `"delivered or refunded unfulfilled → none"`; `"manual moves: deliver from shipped states, revert from delivered, nothing when unpaid or cancelled"`.
- [ ] **Step 2: RED** — `bunx vitest run src/lib/admin/orderActions.test.ts`, module not found.
- [ ] **Step 3: Implement.** Order of checks: cancelled → none; awaiting_payment → await_payment; `labelAction` buy → buy_label; fulfillment in `["delivery_exception","returned"]` → resolve_exception (`reship = labelAction(...).action === "reship"`); fulfillment in `["label_purchased","in_transit"]` and `canChangeFulfillment` → mark_delivered; paid/partially_refunded + unfulfilled + label refused → none with reason; else none.
- [ ] **Step 4: GREEN.** **Step 5: Commit** `feat(admin): next order action and manual moves, computed from the status rules`.

### Task 2: `orderDetail.ts`

**Files:**
- Create: `src/lib/admin/orderDetail.ts`, `src/lib/admin/orderDetail.test.ts`

**Interfaces:**
```ts
export type DetailOrderInput = {   // the fields of Doc<"orders"> the page reads; typed structurally so tests need no Doc
  _id: string; orderNumber: string; createdAt: number; currency?: string;
  customerName?: string; customerEmail?: string; customerPhone?: string;
  shippingAddress?: { line1: string; line2?: string; city: string; state: string; postalCode: string; country: string };
  items: Array<{ variantId: string; name: string; quantity: number; price: number; image: string; colorway?: string; size?: string }>;
  subtotal?: number; shippingFee?: number; tax?: number; taxDetails?: { rate?: number }; total: number; refundedAmount?: number;
  paymentStatus; fulfillmentStatus; cancelledAt?; disputed?: boolean; stripeSessionId?: string; paymentMethod: string;
  carrier?: string; trackingNumber?: string; shippingLabelUrl?: string; adminNotes?: string; manualStatusOverride?: boolean;
};
export type PackingProductInput = {
  variantId: string; nameEn: string; nameEs: string; category?: string; image: string; catalogShot?: string; images?: string[];
  colorways?: Array<{ id: string; nameEn: string; nameEs: string; catalogShot: string; lifestyleImage: string }>;
};
export type PackingLine = {
  key: string; name: string; slug: string; quantity: number; image: string; lifestyleImage?: string;
  colorway?: string; size?: string; archived: boolean; unitLabel: string; lineLabel: string;
};
export type OrderDetailVM = {
  header: { orderNumber: string; age: OrderAge; lifecycle; disputed: boolean; cancelled: boolean; placedLabel: string };
  items: PackingLine[]; itemCount: number;
  money: { subtotalLabel?: string; shippingLabel?: string | "free"; taxLabel?: string; taxRate?: number; refundedLabel?: string; totalLabel: string; paid: boolean };
  shipTo: { name?: string; email?: string; phone?: string; lines: string[]; editable: boolean; missing: boolean };
  labels: { carrier?: string; trackingNumber?: string; trackingUrl: string | null; labelUrl?: string; manualOverride: boolean };
  notes: string;
  danger: { canCancel: boolean; refundable: boolean };   // canCancel = not cancelled; refundable = paymentMethod==="stripe" && !!stripeSessionId && paid
};
export function toOrderDetail(order: DetailOrderInput, products: PackingProductInput[] | undefined, locale: "en" | "es"): OrderDetailVM;
```
Money labels use `Intl.NumberFormat(locale, { style: "currency", currency: "USD" })` (two decimals; not `formatUsd`). `trackingUrl` from `getCarrierTrackingUrl` in `src/lib/tracking.ts` (pure; relative import `../tracking`). `placedLabel` is `toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" })`. Colorway names come from the row by locale; `colorway` on the line is the display name, `size` as stored.

- [ ] **Step 1: Tests**: `"joins a cap line to its Catalog Shot and keeps the slug"`; `"joins a tee line to its Apparel Colorway's Catalog Shot and Lifestyle Shot, naming the colorway by locale"`; `"colorway no longer on the product falls back to the stored image"`; `"a line with no product row is archived and keeps the stored name and image"`; `"money: free shipping, tax rate, refunded line, Total Paid vs Total Due"`; `"shipTo is editable only until a label exists"` (`canEditShippingAddress`), `"missing when there is no line1"`; `"labels: tracking url for USPS, none without a label"`; `"danger: refundable only for Stripe orders with a session"`; `"products undefined (still loading) still builds every line from the order"`.
- [ ] **Step 2: RED.** **Step 3: Implement.** **Step 4: GREEN.** **Step 5: Commit** `feat(admin): order detail view model with packing lines`.

### Task 3: Components, hook, page, copy

**Files:**
- Create: `src/components/admin/ConfirmDialog.tsx`; `src/components/admin/orders/detail/useOrderDetail.ts`, `OrderDetailPage.tsx`, `OrderHeader.tsx`, `NextActionCard.tsx`, `ItemsSection.tsx`, `PackingSheet.tsx`, `MoneySection.tsx`, `ShipToSection.tsx`, `AddressDialog.tsx`, `LabelsSection.tsx`, `ManualTrackingDialog.tsx`, `NotesSection.tsx`, `DangerZone.tsx`, `CancelDialog.tsx`, `PackingSlipPrint.tsx`, `OrderDetailSkeleton.tsx`
- Replace: `src/app/[locale]/admin/orders/[orderNumber]/page.tsx`
- Modify: `src/messages/{en,es}.json`

**Interfaces:**
- `ConfirmDialog({ open, title, body, confirmLabel, destructive?, busy, onConfirm, onClose, children? })` on `AdminModal`; `children` for an optional form (reason, toggle). Labels default to `admin.common.{confirm,cancel}`.
- `useOrderDetail(orderNumber)`: `order = useQuery(getOrderDetailAdmin, { orderNumber })`, `catalog = useQuery(getAllProductsAdmin, {})`; returns `{ order, vm, nextAction, manualMoves, busy, error, success, dismissError, actions: { saveAddress(form), saveNotes(text), saveTracking({carrier, trackingNumber}), markDelivered(), revert(), cancel({ refundStripe, reason }) } }`. Every action sets `busy`, catches, and fills `error` from `ConvexError` data or `admin.common.actionFailed`; successes set `success` from `admin.orderDetail.toast.*` keys (never the server's English message). `markDelivered` → `updateFulfillmentStatusAdmin({ fulfillmentStatus: "delivered" })`; `revert` → `"in_transit"`; `saveTracking` → `updateOrderFulfillmentAdmin`; `saveNotes` → `updateOrderFulfillmentAdmin({ adminNotes })`; `cancel` → `cancelAndRefundOrderAdmin` as the old `handleConfirmCancellation` did (`refundError` → `error`).
- `OrderDetailPage`: `← Orders` link (`/admin/orders`), header, error/success lines, `NextActionCard`, then on phone one column / on `lg` two columns: left `ItemsSection`, `MoneySection`, `OrderRefundsPanel`, `NotesSection`; right `ShipToSection`, `LabelsSection` (+ `LabelHistoryCard`), `DangerZone`. "Order not found" state with a back link. Print button in the header → `window.print()`; `PackingSlipPrint` is `hidden print:block`, the rest `print:hidden`. `useAdminShortcuts({ escape: () => router.push("/admin/orders"), "mod+s": () => activeForm?.submit() })` where `activeForm` is a ref the Address and Notes forms register while open.
- `NextActionCard`: per kind: `buy_label` → primary **Buy label** (amber; `addressMissing` → `admin.orderDetail.next.addressAndLabel`) opening `ShippingLabelModal`; `resolve_exception` → primary **Reship** when `reship`, plus a text link to the refunds section (`#refunds`); `mark_delivered` → primary **Mark delivered** behind `ConfirmDialog`; `await_payment` → text only with the hold expiry; `none` → card hidden, or a rose note with `reason` when present.
- `ItemsSection`: one row per `PackingLine`: 64 px Catalog Shot, name, `colorway · size` line (tees), slug mono, quantity in `text-2xl` on the right, line price under it. Row is a `button` opening `PackingSheet(line)`. Header shows `admin.orderDetail.items.title` and `itemCount`.
- `PackingSheet`: `AdminModal` (`max-w-xl`): Catalog Shot at full width 4:5, then Lifestyle Shot if any, name, `colorway · size`, slug, quantity large, `admin.orderDetail.packing.archived` note when `archived`. Close with ×, Esc (AdminModal already), or tapping the backdrop.
- `ShipToSection`: name / email / phone / address lines; **Edit** button only when `editable`, opening `AddressDialog` (same fields as the old form; submits `saveAddress`). `LabelsSection`: carrier, Tracking Number with copy and the tracking link, `labelUrl` → "Print label (PDF)"; a text link `admin.orderDetail.labels.manual` opens `ManualTrackingDialog` (carrier select USPS/UPS, tracking input, submits `saveTracking`); `manualOverride` note. Manual moves (`revert`) live here as a secondary button behind `ConfirmDialog`; `mark_delivered` is only in the Next card when it is the next action, and here as secondary when `delivery_exception`.
- `NotesSection`: textarea with Save, `⌘S` hint. `DangerZone`: **Cancel order** button when `canCancel`, opening `CancelDialog` (reason textarea; "Refund on Stripe" toggle only when `refundable`, default on).
- Copy: `admin.orderDetail.{back, notFound, print, placed, next.{buyLabel, addressAndLabel, reship, refundInstead, markDelivered, awaitingPayment, holdExpires, blocked}, items.{title, units, tapHint}, packing.{title, archived, quantity, lifestyle}, money.{subtotal, shipping, free, tax, refunded, totalPaid, totalDue}, shipTo.{title, edit, missing, dialogTitle, name, email, phone, line1, line2, city, state, postalCode, country, save}, labels.{title, carrier, tracking, none, copy, copied, track, printLabel, manual, manualTitle, manualSave, override, revert, revertTitle, revertBody, deliverTitle, deliverBody}, notes.{title, placeholder, empty, save}, danger.{title, cancel, cancelTitle, cancelBody, reason, refundStripe, refundStripeHelp, confirm}, toast.{address, notes, tracking, delivered, reverted, cancelled}}` and `admin.common.{confirm, cancel, actionFailed, close}` — in both locales.

- [ ] **Step 1: `ConfirmDialog` and `useOrderDetail`.**
- [ ] **Step 2: Sections, dialogs, `PackingSheet`, `PackingSlipPrint` (port the existing print markup, reading the VM), `OrderDetailPage`; replace the route file; delete the old page.**
- [ ] **Step 3: Copy in both locales; parity check.**
- [ ] **Step 4: Gates** — `bun run test && bunx tsc --noEmit && bunx tsc --noEmit -p convex`; `grep -rn "whatsapp\|: any" src/components/admin/orders/detail "src/app/[locale]/admin/orders/[orderNumber]"` → no output.
- [ ] **Step 5: Preview** (phone and desktop, EN and ES): a Needs Packing order shows **Buy label** as the only primary button; tap an item → Packing sheet with the big Catalog Shot and `colorway · size`; Esc closes the sheet, a second Esc returns to the list; Edit address present before a label, gone after; notes save with `⌘S`; a cancelled or delivered order shows no Next card; `/admin/orders/NOPE` shows not found; print preview shows the packing slip only.
- [ ] **Step 6: Commit** `feat(admin): order detail rebuilt around the next action, with a packing sheet`.
