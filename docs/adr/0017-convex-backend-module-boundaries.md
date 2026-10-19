# Convex Backend Module Boundaries

`convex/products.ts` (~1370 lines), `convex/orders.ts` (~2200) and `convex/stripe.ts` (~1780) each mixed several concerns: seed data, storefront reads, admin edits, drops and migrations; order lifecycle, WhatsApp reservations, the admin desk, fulfillment and analytics; checkout sessions, webhook settlement and refunds. They are split into cohesive modules with no behaviour change. Rules that can be pure are pulled into `*Model.ts` modules with unit tests.

## Decisions

1. **One concern per function module.** Each Convex function module owns one area and stays under ~600 lines. Function paths follow the module (`api.catalog.getVariants`, `internal.whatsappOrders.expireWhatsAppOrderLead`).
2. **Pure rules live in `*Model.ts`.** State transitions, totals and shipping, line naming, cart validation, projections, tracking scans, analytics and Stripe-payload mapping take plain data and return plain data. They have no `ctx` and import only Stripe *types*, so they run in Vitest without Convex or Stripe.
3. **Database helpers live in `*Shared.ts`.** Lookups and writes reused across modules (`requireVariant`, `resolveVariantWithStorageUrl`, `findOrderByTypedNumber`, `releaseStock`, `scheduleSessionExpiry`) live in `catalogShared.ts` and `orderShared.ts`. Stock still goes only through `inventory.ts` (ADR 0007, ADR 0015).
4. **Stripe SDK only in `"use node"` files.** `stripeClient.ts` holds the client, customer upsert, session expiry and refunds. Only `stripeCheckout.ts`, `stripeWebhook.ts` and `stripeRefunds.ts` import it.
5. **Bounded catalog reads.** Whole-catalog scans use `listCatalogVariants` (`take(MAX_CATALOG_VARIANTS = 500)`; the catalog is ~30 products). Drop-alert counts clamp at `MAX_DROP_ALERTS_COUNTED = 1000`. Move to `@convex-dev/aggregate` before a waitlist approaches the cap.
6. **Every function declares `returns:`.** Shared shapes live in `catalogValidators.ts`, `orderValidators.ts` (customer order views) and `analyticsModel.ts`. `returnContracts.test.ts` calls each read once, because convex-test enforces the validators.
7. **Queries never read the clock.** Time-dependent queries (`catalog/drops:getUpcomingDrops`, `catalog/drops:getAllDropsAdmin`, `orders/desk:getAllOrdersAdmin`, `orders/desk:getOrdersAttentionStats`, `analytics/functions:getAnalyticsAdmin`) take a required `clientTime`, which clients get from `useMinuteClock` (floored to the minute so components share one subscription).
8. **Admin lists clamp.** Subscriber lists (1000 newest), account order history (200 newest) and the users list (1000 newest) are bounded; `catalog/drops:deleteDrop` deletes alerts in batches of 500 and schedules `catalog/drops:deleteDropAlertsBatch` for the rest.

## Module map

| Area | Function modules | Pure / helpers |
| --- | --- | --- |
| Catalog | `catalog` (storefront reads, `getLineStock`), `catalogAdmin` (images, stock, price, visibility, editor, tee SKU stock), `drops` (scheduling, Drop Radar, subscribers), `catalogMigrations` (`seedAll`, `migrateUnifiedCatalog`, `setApparelPriceUsd`) | `catalogModel`, `catalogShared`, `catalogData` (seed), `inventory` |
| Orders | `orders` (payment-event log, internal lookups, customer reads/edits, `cancelOrder`), `orderSettlement` (Stripe settlement, refunds, disputes, customer/invoice ids), `whatsappOrders` (reservations, payment link, Zelle, expiry), `orderDesk` (admin lists, stats, status changes, `cancelOrderAdmin`), `orderFulfillment` (labels, tracking webhook), `analytics` | `orderModel`, `reservationModel`, `trackingModel`, `analyticsModel`, `orderShared`, `orderValidators` |
| Stripe | `stripeCheckout` (checkout, reservation, link refresh, session expiry), `stripeWebhook` (webhook, success-page sync), `stripeRefunds` (cancel and refund) | `checkoutModel`, `stripeSettlementModel`, `checkoutMetadata`, `stripeClient` |

## Consequences

- Function paths changed (listed in the commit). Production had not run `migrateUnifiedCatalog` or `setApparelPriceUsd` yet, so those runs use the new names. After the move into domain folders (`6c05384`), they are `catalog/migrations:migrateUnifiedCatalog` and `catalog/migrations:setApparelPriceUsd`.
- A frontend and backend deploy must ship together: old clients calling `api.products.*` or `api.stripe.*` fail until they reload.
- **Domain folders (amendment, `6c05384`).** The modules now live in folders: `catalog/` (queries, admin, drops, migrations, inventory, model, …), `orders/`, `payments/`, `users/`, `shipping/`, `analytics/` and `notifications/`. Function paths follow the file, e.g. `catalog/queries:getVariants` and `orders/desk:getAllOrdersAdmin`. The table above names the original modules.
