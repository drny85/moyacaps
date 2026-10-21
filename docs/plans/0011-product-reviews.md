# Product Reviews Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verified Buyers rate and review Products, an Administrator moderates every review, and Published reviews appear on product pages, Shop cards and the Product JSON-LD.

**Architecture:** A new `convex/reviews/` domain folder (ADR 0017): pure rules in `model.ts`, DB helpers in `shared.ts`, and one function module per audience (`customer.ts`, `public.ts`, `admin.ts`, `invites.ts`). A denormalized `product_review_stats` row per Product keeps cards and JSON-LD at one read. The Review Invite is scheduled from both paths that move an Order into `delivered`.

**Tech Stack:** Convex (convex-test, Vitest), Next.js App Router with next-intl, Resend through `convex/notifications/emails.ts`, Clerk identity.

**Spec:** `CONTEXT.md` (Product Review, Verified Buyer, Review Status, Review Invite), `docs/adr/0028-product-reviews-verified-buyers-and-pre-moderation.md`, and the decisions below.

## Decisions (from the 2026-10-21 grilling)

1. A Product is one `variants` row; its slug is `variantId` (`/products/[slug]`). Reviews key on `variantId`. For a Heavyweight Tee the review notes the bought Apparel Colorway and size; a Cap variant has no extra note.
2. Verified Buyer: signed-in; owns (`clerkUserId`) an Order with `fulfillmentStatus === "delivered"`, no `cancelledAt`, and a line for the variant not fully refunded. Checked on submit and edit only.
3. 1–5 integer stars required; title and body optional; no photos. One review per (Customer, variant); edit returns it to Pending; Customer may hard-delete.
4. Review Status: `pending | published | rejected`. Reject takes an optional reason shown to the Customer. Unpublish moves `published` → `rejected`. No Customer email on reject.
5. Locale stored; shown on both locales untranslated.
6. Display name: first name + last initial ("Robert M."), snapshotted at submit; "Verified Buyer" badge; date; bought note. No avatar.
7. Product page: average, count, Published list newest first. Shop cards: stars + count only when count ≥ 3.
8. Review Invite: one per Order, 7 days after delivery, never repeated, skipped when no line is still reviewable or the email opted out. Lands on `/account/orders`.
9. JSON-LD `aggregateRating` + `review` once ≥ 1 Published.
10. `/admin/reviews` with Pending / Published / Rejected tabs, Pending badge in nav, no new-review email.
11. Soft-deleted User Account: its reviews leave the storefront and stats, rows kept.
12. No store replies in v1.

## Global Constraints

- `REVIEW_INVITE_DELAY_MS = 7 * 24 * 60 * 60 * 1000`
- `CARD_RATING_MIN_COUNT = 3`
- `REVIEW_TITLE_MAX = 80`, `REVIEW_BODY_MAX = 2000`, `REJECT_REASON_MAX = 300` (characters, after trim)
- Every Convex function declares `returns:`; queries never read the clock (ADR 0017 rules 6–7).
- Review text renders as plain text only, never as HTML or Markdown.
- Read `convex/_generated/ai/guidelines.md` before writing Convex code.
- Copy ships in `src/messages/en.json` and `src/messages/es.json` together.
- Do not run `next build` while the dev server runs.

## Review Focus

1. **Script or HTML in title/body/name**: shown literally, never executed. Owning tests are in Task 7 (component renders `<script>` as text) and Task 1 (`normalizeReviewInput` leaves markup untouched; it only trims).
2. **Same Product bought on two Orders, one refunded**: still a Verified Buyer via the other Order. Test in Task 3.
3. **Order reshipped and delivered twice**: still only one Review Invite. Test in Task 6.
4. **Whitespace-only title or body**: stored as absent, not as an empty string. Test in Task 1.
5. **Editing a Published review**: drops out of stats until it is published again, and the average never counts it twice. Test in Task 4.

---

### Task 1: Pure review rules

**Files:**
- Create: `convex/reviews/model.ts`
- Test: `convex/reviews/model.test.ts`

**Interfaces:**
- Produces:
  - `type ReviewStatus = "pending" | "published" | "rejected"`
  - `normalizeReviewInput(input: { rating: number; title?: string; body?: string }): { rating: number; title?: string; body?: string }`. It throws `ConvexError` on a non-integer rating or one outside 1–5, or when a field exceeds its max after trim.
  - `reviewableLines(order: Pick<Doc<"orders">, "items" | "fulfillmentStatus" | "cancelledAt">, refunds: Pick<Doc<"order_refunds">, "status" | "lines">[], variantId: string): { lineIndex: number; colorway?: string; size?: string }[]`. Refunds with status `failed` are ignored. A line is excluded when the quantity refunded is at least the line quantity.
  - `reviewerDisplayName(name: string | undefined): string`. Returns "Robert M." for "Robert Melendez" and "Cher" for "Cher". An empty or undefined name returns `"Verified Buyer"`.
  - `statsDelta(prev: { status: ReviewStatus; rating: number; hidden: boolean } | null, next: { status: ReviewStatus; rating: number; hidden: boolean } | null): { count: number; ratingSum: number }`. A review counts only when it is `published && !hidden`.
  - `cardRating(stats: { count: number; ratingSum: number }): { average: number; count: number } | null`. Returns null when count < `CARD_RATING_MIN_COUNT`. The average is rounded to 1 decimal.
  - The constants listed in Global Constraints.

- [ ] **Step 1: Write failing tests** `describe("normalizeReviewInput")`. It rejects 0, 6 and 4.5. It trims. `"   "` becomes `undefined`. A title of 81 characters throws. `"<script>"` is kept verbatim.
  `describe("reviewableLines")`:
  - a delivered line comes back;
  - `in_transit` gives `[]`;
  - `cancelledAt` set gives `[]`;
  - a qty-2 line refunded 1 is still reviewable;
  - a qty-1 line refunded 1 is excluded;
  - a `failed` refund is ignored;
  - another variant's line is excluded.
  `describe("statsDelta")`:
  - null → published(5) gives `{1,5}`;
  - published(5) → pending(4) gives `{-1,-5}`;
  - published(5) → published(3) gives `{0,-2}`;
  - published → hidden gives `{-1,-r}`;
  - rejected → null gives `{0,0}`.
  `describe("cardRating")`: counts 2 and 3; 14/3 gives 4.7.
- [ ] **Step 2: Run** `bunx vitest run convex/reviews/model.test.ts`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement** the signatures above in `convex/reviews/model.ts`. Use no `ctx` (ADR 0017 rule 2).
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat(reviews): pure review rules`.

### Task 2: Schema, validators and stats helper

**Files:**
- Modify: `convex/schema.ts`
- Create: `convex/reviews/validators.ts`, `convex/reviews/shared.ts`
- Test: `convex/reviews/shared.test.ts`

**Interfaces:**
- Produces these tables:
  - `product_reviews`:
    - fields: `variantId: string`, `clerkUserId: string`, `orderId: Id<"orders">`, `rating: number`, `title?: string`, `body?: string`, `locale: "en" | "es"`, `displayName: string`, `boughtColorway?: string`, `boughtSize?: string`, `status: ReviewStatus`, `rejectReason?: string`, `hiddenAt?: number`, `createdAt`, `updatedAt`, `publishedAt?: number`;
    - indexes: `by_clerkUserId_and_variantId`, `by_variantId_and_status_and_publishedAt`, `by_status_and_updatedAt`, `by_clerkUserId`.
  - `product_review_stats`: `variantId`, `count`, `ratingSum`; index `by_variantId`.
  - `review_invites`: `orderId`, `email`, `sendAt`, `sentAt?`, `skippedReason?`, `unsubscribeToken`, `jobId?: Id<"_scheduled_functions">`; indexes `by_orderId`, `by_unsubscribeToken`.
  - `email_optouts`: `email` (normalized), `kind: "review_invite"`, `createdAt`; index `by_email_and_kind`.
- Produces in `validators.ts`: `reviewStatusValidator`, `publicReviewValidator` (no `clerkUserId`, `orderId` or `rejectReason`), `myReviewValidator`, `adminReviewValidator`, `ratingSummaryValidator`.
- Produces in `shared.ts`: `applyStatsChange(ctx: MutationCtx, variantId: string, prev: ReviewDoc | null, next: ReviewDoc | null): Promise<void>`. It wraps `statsDelta` and creates the stats row on first use.

- [ ] **Step 1: Write failing convex-test** `applyStatsChange keeps count and ratingSum in step`. Insert → publish(5), publish(3), then unpublish the 5. Expected stats row: `{count:1, ratingSum:3}`.
- [ ] **Step 2: Run** `bunx vitest run convex/reviews/shared.test.ts`. Expected: FAIL.
- [ ] **Step 3: Add** the tables, validators and `applyStatsChange`.
- [ ] **Step 4: Run** the test and `bunx convex codegen`. Expected: PASS, and codegen succeeds.
- [ ] **Step 5: Commit** `feat(reviews): schema and stats helper`.

### Task 3: Customer functions

**Files:**
- Create: `convex/reviews/customer.ts`
- Test: `convex/reviews/customer.test.ts`

**Interfaces:**
- Consumes: Task 1 `reviewableLines`, `normalizeReviewInput`, `reviewerDisplayName`; Task 2 `applyStatsChange`.
- Produces:
  - `api.reviews.customer.getMyReviewState({ variantId }) → { canReview: boolean; review: MyReview | null }`. When signed out, it returns `{canReview:false, review:null}`.
  - `api.reviews.customer.getMyReviewableItems({ orderId }) → { variantId, lineIndex, reviewed: boolean }[]`. This is for the account Order page; it throws when the Order is not the caller's.
  - `api.reviews.customer.submitReview({ variantId, rating, title?, body?, locale }) → Id<"product_reviews">`. It upserts and always sets `status:"pending"` and clears `rejectReason`. It scans the caller's Orders through `orders.by_clerkUserId`, takes the newest Order with a reviewable line, and snapshots `orderId`, `boughtColorway` and `boughtSize` from it. The name comes from the `users` row, falling back to the Order's `customerName`.
  - `api.reviews.customer.deleteMyReview({ variantId }) → null`.

- [ ] **Step 1: Write failing tests:**
  - `submitReview rejects a signed-out caller`.
  - `rejects an in_transit Order`.
  - `rejects an unclaimed guest Order with the same email`.
  - `accepts when one of two Orders has a fully refunded line and the other is delivered` (Review Focus 2).
  - `edit of a published review returns it to pending and drops stats`.
  - `deleteMyReview of a published review decrements stats`.
  - `getMyReviewableItems marks reviewed lines`.
- [ ] **Step 2: Run** `bunx vitest run convex/reviews/customer.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Identity comes from `ctx.auth.getUserIdentity().subject`, never from args.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(reviews): customer submit, edit, delete`.

### Task 4: Public reads and admin moderation

**Files:**
- Create: `convex/reviews/public.ts`, `convex/reviews/admin.ts`
- Modify: `convex/orders/returnContracts.test.ts` (call each new read once)
- Test: `convex/reviews/admin.test.ts`, `convex/reviews/public.test.ts`

**Interfaces:**
- Consumes: Task 2 `applyStatsChange` and validators; `requireAdmin` from `convex/lib/auth.ts`.
- Produces:
  - `api.reviews.public.getProductReviews({ variantId, paginationOpts })` returns Published reviews with no `hiddenAt`, newest `publishedAt` first.
  - `api.reviews.public.getRatingSummary({ variantId }) → { average: number; count: number } | null`. Returns null when count is 0.
  - `api.reviews.public.getCardRatings({}) → Record<variantId, { average; count }>`. It holds only entries where `cardRating` is not null and reads `product_review_stats` with `take(500)`.
  - `api.reviews.admin.listReviewsAdmin({ status, paginationOpts })`, ordered newest `updatedAt` first, with the product name joined in.
  - `api.reviews.admin.getPendingReviewCount({}) → number`, clamped at 100.
  - `api.reviews.admin.publishReview({ reviewId })` sets `publishedAt`.
  - `api.reviews.admin.rejectReview({ reviewId, reason? })` also unpublishes a Published review.

- [ ] **Step 1: Write failing tests:**
  - `non-admin cannot publish`.
  - `publish → getRatingSummary average 5 count 1`.
  - `reject published with reason → summary null and reason visible in getMyReviewState`.
  - `getCardRatings omits a Product with 2 reviews and includes one with 3`.
  - `getProductReviews never returns clerkUserId`.
  - `edit after publish is not counted twice` (Review Focus 5).
- [ ] **Step 2: Run** `bunx vitest run convex/reviews`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `bunx vitest run convex/reviews convex/orders/returnContracts.test.ts`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(reviews): public reads and admin moderation`.

### Task 5: Soft-deleted accounts hide reviews

**Files:**
- Modify: `convex/users/functions.ts` (`softDeleteUser`, around line 174)
- Test: `convex/reviews/softDelete.test.ts`

**Interfaces:**
- Consumes: `applyStatsChange`.
- Produces: `hideReviewsForUser(ctx, clerkUserId, now)` in `convex/reviews/shared.ts`. It sets `hiddenAt` on each of that user's reviews and adjusts stats.

- [ ] **Step 1: Write failing test** `softDeleteUser removes the user's published review from summary and list but keeps the row`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** and call it from `softDeleteUser`.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(reviews): hide reviews of deleted accounts`.

### Task 6: Review Invite

**Files:**
- Create: `convex/reviews/invites.ts`, `convex/notifications/templates/ReviewInviteEmail.tsx`
- Modify:
  - `convex/orders/fulfillment.ts:189` (carrier delivered);
  - `convex/orders/desk.ts:408` (manual move to delivered);
  - `convex/http.ts` (one-click opt-out route `/review-invites/unsubscribe`, modelled on `notifications/unsubscribeHttp.ts`);
  - `convex/notifications/orderEmails.ts` (add `reviewInviteCopy(orderNumber)` and `reviewInviteIdempotencyKey(orderNumber)`).
- Test: `convex/reviews/invites.test.ts`, `convex/notifications/orderEmails.test.ts`

**Interfaces:**
- Consumes: Task 3's reviewable-line logic (through `reviewableLines`); `generateUnsubscribeToken` and `listUnsubscribeHeaders` from `notifications/unsubscribe.ts`.
- Produces:
  - `scheduleReviewInvite(ctx: MutationCtx, order: Doc<"orders">, now: number): Promise<void>` in `invites.ts`. It does nothing when the Order has no email or no `clerkUserId`, or when a `review_invites` row already exists for the Order. Otherwise it inserts a row with `sendAt = now + REVIEW_INVITE_DELAY_MS` and calls `scheduler.runAt(sendAt, internal.reviews.invites.sendReviewInvite, { inviteId })`.
  - `internal.reviews.invites.sendReviewInvite({ inviteId })` is an internal action. It reads the context through an internal query and skips with `skippedReason` in each of these cases: `opted_out`, `nothing_to_review`, `already_sent`, `order_not_delivered`. Otherwise it sends the email linking to `${NEXT_PUBLIC_APP_URL}/account/orders?review=<orderNumber>` and sets `sentAt`.
  - `internal.reviews.invites.optOutByToken({ token })` inserts into `email_optouts`.

  Guest Orders have no `clerkUserId` at delivery time, so they get no invite. The account Order page still offers reviews after a claim.
- [ ] **Step 1: Write failing tests:**
  - `delivered twice schedules one invite` (Review Focus 3).
  - `send skips when every line is already reviewed`.
  - `send skips an opted-out email`.
  - `opt-out token is single-purpose and unknown tokens are ignored`.
  - `reviewInviteCopy subject mentions the order number`.
- [ ] **Step 2: Run** `bunx vitest run convex/reviews/invites.test.ts convex/notifications/orderEmails.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Call `scheduleReviewInvite` right after each existing delivered-email `runAfter`.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(reviews): review invite seven days after delivery`.

### Task 7: Storefront UI

**Files:**
- Create:
  - `src/components/reviews/StarRating.tsx` (display, plus an input mode that uses radio buttons for accessibility);
  - `src/components/reviews/ReviewForm.tsx` (sheet or modal: stars, title, body, submit, delete; shows the Pending / Rejected status and reason);
  - `src/components/reviews/ProductReviews.tsx` (summary, paginated list, and a "Write a review" button when `getMyReviewState.canReview`).
- Modify:
  - `src/components/product/ProductView.tsx` (mount `ProductReviews`);
  - `src/components/catalog/ProductCard.tsx` (optional `rating` prop);
  - `src/components/shop/ShopView.tsx` (one `getCardRatings` subscription passed into cards);
  - `src/app/[locale]/account/orders/page.tsx` ("Write a review" or "Edit review" per line from `getMyReviewableItems`, and auto-open the Order named by `?review=`);
  - `src/messages/en.json`, `src/messages/es.json` (`Reviews` namespace).
- Test: `src/components/reviews/ProductReviews.test.tsx`

- [ ] **Step 1: Write failing tests:**
  - `renders title "<script>alert(1)</script>" as text` (Review Focus 1).
  - `shows "Bought: Black / L" for a tee review`.
  - `hides Write a review when canReview is false`.
  - `ProductCard renders no stars without rating`.
- [ ] **Step 2: Run** `bunx vitest run src/components/reviews`. Expected: FAIL.
- [ ] **Step 3: Implement.** Never use `dangerouslySetInnerHTML`.
- [ ] **Step 4: Run** the tests and `bunx tsc --noEmit`. Expected: PASS.
- [ ] **Step 5: Verify in the browser preview.** Submit as a seeded Verified Buyer and see the Pending status. Publish from Convex and see the review on the product page.
- [ ] **Step 6: Commit** `feat(reviews): storefront and account review UI`.

### Task 8: Admin reviews page

**Files:**
- Create: `src/app/[locale]/admin/reviews/page.tsx`, `src/components/admin/reviews/ReviewQueue.tsx`
- Modify: `src/components/admin/AdminConsoleLayout.tsx:97-107` (Reviews nav item with a `getPendingReviewCount` badge), and the admin namespaces in both message files.

- [ ] **Step 1: Implement** the tabs (Pending default, Published, Rejected). Each row shows the Product, stars, title, body, display name, date and bought note. Actions: Publish; Reject with an optional reason (≤ `REJECT_REASON_MAX`, enforced in the UI and server); Unpublish on Published.
- [ ] **Step 2: Verify in the preview.** Publish, reject and unpublish all move the row between tabs, and the badge count follows.
- [ ] **Step 3: Commit** `feat(admin): reviews moderation page`.

### Task 9: Product JSON-LD ratings

**Files:**
- Modify:
  - `src/lib/seo/jsonLd.ts:106` (`productJsonLd` gains an optional last param `reviews?: { summary: { average: number; count: number }; latest: PublicReview[] }`);
  - `src/components/seo/ProductJsonLd.tsx`;
  - `src/app/[locale]/products/[slug]/page.tsx` (fetch `getRatingSummary` and the first 5 of `getProductReviews` with `queryForStaticRender`, failing soft like `getShipping`).
- Test: `src/lib/seo/seo.test.ts`

- [ ] **Step 1: Write failing tests:**
  - `productJsonLd omits aggregateRating without reviews`.
  - `adds aggregateRating {ratingValue 4.7, reviewCount 3, bestRating 5, worstRating 1}`, and `review[]` items with `author.name` = displayName and `reviewRating.ratingValue`.
- [ ] **Step 2: Run** `bunx vitest run src/lib/seo/seo.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the full suite with `bun run test` and `bunx tsc --noEmit`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(seo): review ratings in product JSON-LD`.

## Rollout

- Deploy Convex before Next (new tables and functions). Convex prod deploys stay with the user.
