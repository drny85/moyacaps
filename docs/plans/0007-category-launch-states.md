# Category Launch States Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Administrator sets each category (Caps, Tees) to Live, Coming Soon or Hidden, products stay hidden until turned on, and a Coming Soon category shows a teaser with a countdown and a waitlist that is emailed at launch.

**Architecture:** One pure visibility rule (`isCustomerVisible`) gates every public catalog read and the checkout stock check. Category Status lives on the `store_settings` row; changing it schedules the go-live job, the launch emails and a storefront revalidation, all from Convex. The storefront reads Category Status like the catalog: a static seed from the locale layout, replaced by a live `useQuery`.

**Tech Stack:** Convex (queries, mutations, scheduler, `@convex-dev/resend`), Next.js App Router (ISR, route handler, `revalidatePath`), next-intl, Vitest + `convex-test`.

**Spec:** [ADR 0022](../adr/0022-category-launch-states.md). Vocabulary: `CONTEXT.md`.

## Global Constraints

- Read `convex/_generated/ai/guidelines.md` before touching `convex/`. Every Convex function declares `args` and `returns` validators.
- Category keys are the existing `Category` type from `convex/catalog/rules.ts`: `"headwear"` (Caps, URL `caps`) and `"apparel"` (Tees, URL `tees`).
- Category Status values: `"live" | "coming_soon" | "hidden"`. A missing value means `"live"`.
- Headline override: at most 80 characters per language, trimmed; empty means "use default copy".
- Launch date: only with `coming_soon`, must be in the future, at most 365 days ahead.
- Revalidate request: `POST {NEXT_PUBLIC_APP_URL}/api/revalidate`, header `x-revalidate-secret: <REVALIDATE_SECRET>`. Secret compared in constant time. 401 on mismatch or missing env.
- All storefront copy in both `src/messages/en.json` and `src/messages/es.json`.
- Pure logic in plain modules with `*.test.ts` next to them (engineering standard: modular, testable).
- Tests: `npx vitest run <path>`. Full suite: `npm test`. Types: `npx tsc --noEmit`.
- Task 1 ships to prod and its migration runs **before** Task 3's strict check deploys, or existing products vanish.

## Review Focus

1. **Stale scheduled go-live.** The Administrator reschedules or clears the date after a job was queued. The old job must do nothing. (Task 4 test `goLive ignores a stale launchAt`.)
2. **Gated product already in a cart.** A Customer added a tee, then Tees became Coming Soon. Checkout must reject the line as `unavailable`, not sell it. (Task 3 test `checkStock rejects a product in a non-live category`.)
3. **Revalidation down or misconfigured.** Missing `REVALIDATE_SECRET` or the site is unreachable. The status change must still commit, and the action must log, not throw in a retry loop. (Task 4 test `revalidateStorefront swallows fetch failure`.)
4. **Repeat or late sign-ups.** Same contact typed with different case/whitespace returns the existing row; sign-up when the category is Live or Hidden is refused. (Task 5 tests.)
5. **Launch email sent twice.** The category is flipped Live, then off, then Live again. Each subscriber is emailed at most once. (Task 5 test `second go-live sends nobody new`.)

---

### Task 1: Strict product availability + backfill migration

**Files:**
- Modify: `convex/catalog/model.ts` (`nextAvailability`)
- Modify: `convex/catalog/migrations.ts` (new `backfillAvailability`)
- Test: `convex/catalog/model.test.ts`, `convex/catalog/migrations.test.ts`

**Interfaces:**
- Produces: `nextAvailability(current: boolean | undefined, requested: boolean | undefined): boolean` where `undefined` current counts as hidden. `internal.catalog.migrations.backfillAvailability({ cursor?: string | null }) -> { patched: number; isDone: boolean }`.

- [ ] **Step 1: Write the failing tests**

```ts
it("toggles a never-set product to visible", () => {
  expect(nextAvailability(undefined, undefined)).toBe(true);
  expect(nextAvailability(true, undefined)).toBe(false);
  expect(nextAvailability(false, undefined)).toBe(true);
  expect(nextAvailability(undefined, false)).toBe(false);
});

it("backfillAvailability sets missing isAvailable to true and leaves explicit values", async () => {
  // rows: a (no field), b (false), c (true)
  // after run: a === true, b === false, c === true; result.isDone === true
});
```

- [ ] **Step 2: Run** `npx vitest run convex/catalog/model.test.ts convex/catalog/migrations.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** `nextAvailability` returns `requested ?? current !== true`. `backfillAvailability` is an `internalMutation` that pages `variants` with `.paginate({ cursor, numItems: 100 })`, patches rows where `isAvailable === undefined`, and schedules itself with the next cursor until done.
- [ ] **Step 4: Run tests.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(catalog): backfill isAvailable so missing means hidden`.
- [ ] **Step 6: Deploy and run on dev, then prod:** `npx convex run catalog/migrations:backfillAvailability '{}'` (add `--prod` for prod). Verify with `npx convex data variants` that no row lacks `isAvailable`.

---

### Task 2: Category Status model, storage and admin mutation

**Files:**
- Create: `convex/settings/launch.ts` (pure types, defaults, validation, `getCategoryLaunches`)
- Create: `convex/settings/launch.test.ts`
- Modify: `convex/schema.ts` (`store_settings.categoryLaunch`)
- Modify: `convex/settings/functions.ts` (`getStorefrontLaunch`, `setCategoryLaunch`)
- Modify: `convex/settings/functions.test.ts`
- Modify: `CONTEXT.md` (add **Category Status**, **Coming Soon Teaser**; Product entry: "starts hidden; shown only when visible and its category is Live")

**Interfaces:**
- Produces (from `convex/settings/launch.ts`):
  - `type CategoryStatus = "live" | "coming_soon" | "hidden"`
  - `type CategoryLaunch = { status: CategoryStatus; launchAt?: number; headlineEn?: string; headlineEs?: string }`
  - `type CategoryLaunches = Record<Category, CategoryLaunch>`
  - `const DEFAULT_CATEGORY_LAUNCHES: CategoryLaunches` (both `{ status: "live" }`)
  - `categoryLaunchValidator` (Convex validator for `CategoryLaunch` plus optional `launchJobId: v.id("_scheduled_functions")`, stored only)
  - `validateCategoryLaunch(input: CategoryLaunch, now: number): FieldError[]` (codes: `launchAt_requires_coming_soon`, `launchAt_past`, `launchAt_too_far`, `headline_too_long`)
  - `getCategoryLaunches(ctx: Pick<QueryCtx, "db">): Promise<CategoryLaunches>` (no job ids)
- Produces (from `convex/settings/functions.ts`):
  - `api.settings.functions.getStorefrontLaunch({}) -> CategoryLaunches` (public)
  - `api.settings.functions.setCategoryLaunch({ category, status, launchAt?, headlineEn?, headlineEs? }) -> null` (Administrator). Task 4 adds scheduling to it.
  - `writeCategoryLaunch(ctx: MutationCtx, category: Category, next: CategoryLaunch & { launchJobId?: Id<"_scheduled_functions"> }): Promise<void>` exported helper; inserts the row with `DEFAULT_SHIPPING_SETTINGS` when absent.

- [ ] **Step 1: Write failing tests**

```ts
// launch.test.ts
it("defaults to live when the row or field is missing", async () => { /* getCategoryLaunches on empty db */ expect(r).toEqual(DEFAULT_CATEGORY_LAUNCHES); });
it("rejects a launch date unless coming_soon", () => expect(codes(validateCategoryLaunch({ status: "live", launchAt: now + 1 }, now))).toContain("launchAt_requires_coming_soon"));
it("rejects past and >365-day dates", ...);       // launchAt_past, launchAt_too_far
it("rejects headlines over 80 chars after trim", ...); // headline_too_long

// functions.test.ts
it("setCategoryLaunch requires an Administrator", ...);  // anonymous -> throws
it("setCategoryLaunch keeps shipping settings and records a catalog event", ...); // event type "category_launch_set"
it("getStorefrontLaunch never returns launchJobId", ...);
```

- [ ] **Step 2: Run** `npx vitest run convex/settings`. Expected: FAIL.
- [ ] **Step 3: Implement** the module, schema field `categoryLaunch: v.optional(v.object({ headwear: categoryLaunchValidator, apparel: categoryLaunchValidator }))`, both functions, and the CONTEXT.md entries. Trim headlines and store empty as absent. Audit with `recordCatalogEvent` + `diffFields` like `updateStoreSettings`.
- [ ] **Step 4: Run tests.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(settings): store a launch status per category`.

---

### Task 3: Enforce visibility on the server

**Files:**
- Modify: `convex/catalog/model.ts` (`isCustomerVisible`, `filterCatalogVariants`, `isUpcomingDrop` callers)
- Modify: `convex/catalog/queries.ts` (`getVariants`, `getCartVariants`, `getVariantById`, `getProductBySlug`)
- Modify: `convex/catalog/inventory.ts` (`checkStock`)
- Modify: `convex/catalog/drops.ts` (`getUpcomingDrops`)
- Test: `convex/catalog/model.test.ts`, `convex/catalog/queries.test.ts`, `convex/catalog/inventory.test.ts`

**Interfaces:**
- Consumes: `CategoryLaunches`, `getCategoryLaunches` (Task 2).
- Produces: `isCustomerVisible(variant: Pick<Doc<"variants">, "archivedAt" | "isAvailable" | "category" | "silhouette">, launches: CategoryLaunches): boolean`. `CatalogFilter` gains required `launches: CategoryLaunches`. `getCartVariants` returns each row with `isAvailable` replaced by `isCustomerVisible(...)` so the existing cart/checkout UI marks it unavailable with no client change.

- [ ] **Step 1: Write failing tests**

```ts
it("isCustomerVisible needs isAvailable === true and a live category", () => {
  const live = DEFAULT_CATEGORY_LAUNCHES;
  const teesSoon = { ...live, apparel: { status: "coming_soon" } };
  expect(isCustomerVisible({ ...cap, isAvailable: undefined }, live)).toBe(false);
  expect(isCustomerVisible({ ...cap, isAvailable: true }, live)).toBe(true);
  expect(isCustomerVisible({ ...tee, isAvailable: true }, teesSoon)).toBe(false);
  expect(isCustomerVisible({ ...cap, isAvailable: true, archivedAt: 1 }, live)).toBe(false);
});
it("getVariants omits products of a coming_soon category", ...);
it("getVariants with includeUnavailable as admin still lists them", ...);
it("getProductBySlug returns null for a customer and the product for an admin with allowUnavailable", ...);
it("getCartVariants returns a gated tee with isAvailable false", ...);
it("checkStock rejects a product in a non-live category", ...); // reason "unavailable"
it("getUpcomingDrops omits drops in a non-live category", ...);
```

- [ ] **Step 2: Run** `npx vitest run convex/catalog`. Expected: new tests FAIL.
- [ ] **Step 3: Implement.** `variantCategory` returns a string; narrow to `Category` with a fallback to `"headwear"` (matches "caps seeded before categories existed count as headwear"). Every listed read calls `getCategoryLaunches` once per query. Update existing tests whose fixtures relied on a missing `isAvailable` meaning visible: give those fixtures `isAvailable: true`.
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(catalog): hide products of categories that are not live`.

---

### Task 4: Scheduled go-live and storefront revalidation

**Files:**
- Create: `convex/settings/revalidate.ts` (internal action)
- Create: `src/app/api/revalidate/route.ts`
- Create: `src/lib/server/revalidateSecret.ts` + `.test.ts` (pure constant-time check)
- Modify: `convex/settings/functions.ts` (`setCategoryLaunch` scheduling, `goLive`)
- Test: `convex/settings/functions.test.ts`, `convex/settings/revalidate.test.ts`

**Interfaces:**
- Consumes: `writeCategoryLaunch`, `validateCategoryLaunch` (Task 2).
- Produces:
  - `internal.settings.functions.goLive({ category, launchAt: number }) -> null`: sets `live` only when the stored status is `coming_soon` and stored `launchAt === args.launchAt`.
  - `internal.settings.revalidate.revalidateStorefront({}) -> null`.
  - `onCategoryLaunchChanged(ctx: MutationCtx, category: Category, before: CategoryStatus, after: CategoryStatus): Promise<void>`: always schedules `revalidateStorefront`. Called by `setCategoryLaunch` and `goLive`. Task 5 extends it to schedule the launch emails.
  - `isValidRevalidateSecret(provided: string | null, expected: string | undefined): boolean`.

- [ ] **Step 1: Write failing tests**

```ts
it("setCategoryLaunch with launchAt schedules goLive at that time and cancels the previous job", ...);
it("clearing launchAt cancels the job", ...);
it("goLive ignores a stale launchAt", ...);          // status stays coming_soon
it("goLive sets live and schedules revalidateStorefront", ...);
it("revalidateStorefront swallows fetch failure", ...); // stub fetch to reject; resolves null
it("isValidRevalidateSecret", () => {
  expect(isValidRevalidateSecret("abc", "abc")).toBe(true);
  expect(isValidRevalidateSecret("abd", "abc")).toBe(false);
  expect(isValidRevalidateSecret(null, "abc")).toBe(false);
  expect(isValidRevalidateSecret("abc", undefined)).toBe(false);
  expect(isValidRevalidateSecret("", "")).toBe(false);
});
```

- [ ] **Step 2: Run** `npx vitest run convex/settings src/lib/server`. Expected: FAIL.
- [ ] **Step 3: Implement.** Scheduling uses `ctx.scheduler.runAt(launchAt, internal.settings.functions.goLive, ...)`; store the id as `launchJobId`; cancel with `ctx.scheduler.cancel`. `goLive` clears `launchAt` and `launchJobId` when it flips. `revalidateStorefront` reads `NEXT_PUBLIC_APP_URL` and `REVALIDATE_SECRET`, logs and returns when either is missing, wraps `fetch` in try/catch. The route handler: `POST` only, `isValidRevalidateSecret` with `crypto.timingSafeEqual` on equal-length buffers, then `revalidatePath("/[locale]", "layout")`, respond 204; otherwise 401.
- [ ] **Step 4: Run tests.** Expected: PASS.
- [ ] **Step 5: Set env:** generate one secret (`openssl rand -hex 32`), set it with `npx convex env set REVALIDATE_SECRET …` (dev and `--prod`) and in Vercel (`vercel env add REVALIDATE_SECRET`). Ask the user before setting prod values.
- [ ] **Step 6: Commit** `feat(settings): schedule category launches and refresh the storefront`.

---

### Task 5: Category waitlist and launch emails

**Files:**
- Modify: `convex/schema.ts` (`drop_alerts`: `variantId` optional, `category` optional, index `by_category_and_contact` on `["category", "contact"]`, index `by_category_and_notifiedAt` on `["category", "notifiedAt"]`)
- Modify: `convex/catalog/drops.ts` (existing subscriber listing tolerates rows without `variantId`; skip them)
- Modify: `convex/catalog/validators.ts` (`dropSubscriberRow.variantId` optional only if the admin list needs it; otherwise filter category rows out)
- Create: `convex/notifications/launchAlerts.ts`
- Create: `convex/notifications/templates/CategoryLaunchEmail.tsx`
- Modify: `convex/settings/functions.ts` (`onCategoryLaunchChanged` schedules `claimLaunchEmails`)
- Test: `convex/notifications/launchAlerts.test.ts`

**Interfaces:**
- Consumes: `getCategoryLaunches` (Task 2), `onCategoryLaunchChanged` (Task 4).
- Produces:
  - `api.notifications.launchAlerts.subscribeToCategoryLaunch({ category, contact, channel, name?, clerkUserId?, locale }) -> { success: boolean; alreadySubscribed: boolean; id: Id<"drop_alerts"> }` (same normalization as `subscribeToDropAlert`: trim + lowercase; throws `"This category is not accepting sign-ups"` unless `coming_soon`).
  - `internal.notifications.launchAlerts.claimLaunchEmails({ category }) -> null`: stamps `notifiedAt` on up to 100 un-notified `email` rows, schedules `sendLaunchEmails` with their ids, reschedules itself when it claimed a full batch.
  - `internal.notifications.launchAlerts.sendLaunchEmails({ ids: Id<"drop_alerts">[] }) -> null` (internal action; `resend.sendEmail` per row, locale-specific subject and link to `/{locale}/products?category=caps|tees`).
  - `api.notifications.launchAlerts.getCategoryWaitlistAdmin({ category }) -> Array<{ _id; contact; channel; name?; locale; createdAt; notifiedAt? }>` (Administrator, newest first, max 1000).
  - `api.notifications.launchAlerts.markAlertNotified({ id }) -> null` (Administrator).

- [ ] **Step 1: Write failing tests**

```ts
it("subscribes once per normalized contact", ...);      // " A@B.com " then "a@b.com" -> alreadySubscribed true
it("refuses sign-ups unless the category is coming_soon", ...);
it("claimLaunchEmails stamps only email rows of that category", ...); // whatsapp rows and other category untouched
it("second go-live sends nobody new", ...);            // run claim twice; second claims 0
it("getCategoryWaitlistAdmin requires an Administrator", ...);
```

- [ ] **Step 2: Run** `npx vitest run convex/notifications convex/catalog`. Expected: new tests FAIL.
- [ ] **Step 3: Implement.** Follow `sendOrderDispatchedEmail` for the Resend call and template rendering. Copy for the email: EN subject `"{Caps|Tees} just dropped — Good Luck"`, ES `"¡Ya salieron las {gorras|playeras}! — Good Luck"`.
- [ ] **Step 4: Run** `npm test` and `npx tsc --noEmit`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(drops): category waitlist with launch emails`.

---

### Task 6: Admin controls

**Files:**
- Create: `src/lib/admin/categoryLaunch.ts` + `.test.ts`
- Create: `src/components/admin/CategoryLaunchCard.tsx`
- Create: `src/components/admin/CategoryWaitlist.tsx`
- Modify: `src/app/[locale]/admin/products/page.tsx` (render `CategoryLaunchCard` above the grid)
- Modify: `src/app/[locale]/admin/drops/page.tsx` (render `CategoryWaitlist` per category)
- Modify: `src/messages/en.json`, `src/messages/es.json`

**Interfaces:**
- Consumes: `getStorefrontLaunch`, `setCategoryLaunch` (Task 2/4), `getCategoryWaitlistAdmin`, `markAlertNotified` (Task 5), `getAllProductsAdmin` (existing), `DateTimePicker`, the confirm-dialog pattern of `AvailabilityConfirmDialog`.
- Produces:
  - `needsLaunchConfirm(before: CategoryStatus, after: CategoryStatus): boolean` (true when leaving `live`)
  - `listedCount(products: AdminRow[], category: Category): number` (rows with `isAvailable === true`, not archived, in that category)
  - `whatsAppChatUrl(contact: string, text: string): string` (reuse `src/lib/whatsapp.ts` if it already builds `wa.me` links)

- [ ] **Step 1: Write failing tests**

```ts
it("needsLaunchConfirm only when leaving live", () => {
  expect(needsLaunchConfirm("live", "coming_soon")).toBe(true);
  expect(needsLaunchConfirm("live", "hidden")).toBe(true);
  expect(needsLaunchConfirm("coming_soon", "live")).toBe(false);
  expect(needsLaunchConfirm("hidden", "coming_soon")).toBe(false);
});
it("listedCount counts visible, unarchived products of the category", ...);
```

- [ ] **Step 2: Run** `npx vitest run src/lib/admin/categoryLaunch.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Card per category: segmented control Live / Coming soon / Hidden; when Coming soon, optional `DateTimePicker` and EN/ES headline inputs (80-char counter); Save calls `setCategoryLaunch`; server `FieldError` codes map to inline messages. Leaving Live opens the confirm dialog: "{count} products will disappear from the store. Carts holding them will show them as unavailable." Waitlist lists contact, channel, date, notified state; WhatsApp rows get an "Open chat" link and "Mark notified".
- [ ] **Step 4: Run tests.** Expected: PASS.
- [ ] **Step 5: Verify in the browser** (`preview_start`): set Tees to Coming soon with a date 2 minutes ahead, confirm the card shows the countdown state, wait for it to flip to Live.
- [ ] **Step 6: Commit** `feat(admin): category launch controls and waitlists`.

---

### Task 7: Storefront teaser and gating

**Files:**
- Create: `src/lib/launch.ts` + `.test.ts` (pure)
- Create: `src/lib/countdown.ts` + `.test.ts` (extract `TimeRemaining` math from `DropRadar.tsx`)
- Create: `src/hooks/useCategoryLaunches.ts`
- Create: `src/components/drops/ComingSoonTeaser.tsx`
- Create or extract: `src/components/drops/AlertSignupForm.tsx` (the email/WhatsApp form now inside `DropRadar.tsx`, taking an `onSubmit(contact, channel, name?)` prop; `DropRadar` uses it too)
- Modify: `src/components/providers/CatalogProvider.tsx` (`launchSeed` prop)
- Modify: `src/app/[locale]/layout.tsx` (seed `getStorefrontLaunch` like `loadCatalogSeed`)
- Modify: `src/app/[locale]/products/category/[category]/page.tsx` (server: `hidden` → `notFound()`, `coming_soon` → teaser)
- Modify: `src/components/shop/ShopView.tsx` (teaser cards; store-wide teaser when no category is live)
- Modify: `src/lib/navigation.ts` + `src/components/layout/Navbar.tsx` ("Soon" badge, hide hidden)
- Modify: `src/components/hero/CategoryTiles.tsx` ("Dropping soon", hide hidden)
- Modify: `src/components/catalog/FeaturedProducts.tsx`, `src/components/drops/DropRadar.tsx` (render nothing when empty)
- Modify: product page admin banner (where the existing hidden-product banner renders)
- Modify: `src/lib/seo/sitemap.ts` (omit category URLs that are not live)
- Modify: `src/messages/en.json`, `src/messages/es.json`

**Interfaces:**
- Consumes: `getStorefrontLaunch`, `subscribeToCategoryLaunch`, `CategoryLaunches`, `CategoryStatus`.
- Produces:
  - `SHOP_TO_CATEGORY: Record<ShopCategory, Category>` (`caps → headwear`, `tees → apparel`)
  - `statusFor(launches: CategoryLaunches, shop: ShopCategory): CategoryStatus`
  - `liveShopCategories(launches): ShopCategory[]`, `teaserShopCategories(launches): ShopCategory[]`
  - `teaserHeadline(launch: CategoryLaunch, locale: "en" | "es", fallback: string): string`
  - `timeRemaining(target: number, now: number): { days; hours; minutes; seconds; totalMs; isLive }`
  - `useCategoryLaunches(): CategoryLaunches` (seed, then live query)
  - `<ComingSoonTeaser category={ShopCategory | "all"} />`

- [ ] **Step 1: Write failing tests**

```ts
it("statusFor maps caps/tees to headwear/apparel", ...);
it("liveShopCategories and teaserShopCategories split by status", ...);
it("teaserHeadline uses the override for the locale, else the fallback", ...);
it("timeRemaining clamps at zero and flags isLive", () => {
  expect(timeRemaining(1000, 2000)).toMatchObject({ totalMs: 0, isLive: true });
  expect(timeRemaining(90_061_000, 0)).toMatchObject({ days: 1, hours: 1, minutes: 1, seconds: 1 });
});
it("PRIMARY_NAV filtered: hidden category removed, coming_soon flagged soon", ...);
it("sitemap omits the category URL of a non-live category", ...);
```

- [ ] **Step 2: Run** `npx vitest run src`. Expected: new tests FAIL.
- [ ] **Step 3: Implement.** Default teaser copy: EN "{Caps|Tees} — Dropping soon" / "Be first in line. We'll tell you the moment they drop."; ES "{Gorras|Playeras} — Muy pronto" / "Sé el primero. Te avisamos en cuanto salgan." Store-wide: EN "Something's dropping soon", ES "Algo viene muy pronto". When the countdown reaches zero, show "Dropping now…" until the live query flips the status.
- [ ] **Step 4: Run** `npm test`, `npx tsc --noEmit`, `npm run build`. Expected: PASS.
- [ ] **Step 5: Verify in the browser** at mobile and desktop width: Tees Coming soon (nav badge, `/en/products?category=tees` teaser with countdown, all-products grid has only caps plus one teaser card, homepage tile says "Dropping soon", tee product URL returns 404 for a customer); Tees Hidden (no nav link, no tile, category URL 404); both Coming soon (store-wide teaser, homepage hides product sections); sign up on the teaser, then flip Live and confirm the email row gets `notifiedAt`.
- [ ] **Step 6: Commit** `feat(storefront): coming soon teaser and category gating`.
