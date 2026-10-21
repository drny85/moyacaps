# Admin Shell, Home and Settings Implementation Plan (plan 0009, PR 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the admin Analytics page with Home at `/admin`, add a Settings page, rebuild the sidebar to five nav items, remove every WhatsApp surface and dev tool from the admin, and unify the low-stock threshold.

**Architecture:** Backend first: one `LOW_STOCK_UNITS`, `computeAnalytics` reshaped (30 local-day buckets, today/7d/30d windows, low stock covering tee SKUs, no payment breakdown), a read-only `getAdminRecipient` query, and the test alert moved to an internal action driven by a script. Then one pure view model (`src/lib/admin/homeView.ts`) that Home renders, a Settings page assembled from existing cards plus two small new ones, and the shell edits. Every string lands under `admin.*` in both locales.

**Tech Stack:** Next.js 16 App Router, React 19, Convex (`convex-test`), next-intl, Tailwind, Vitest, Bun.

**Spec:** `docs/plans/0009-admin-ops-redesign.md` (D1–D9, D18–D21, D23, D25; Backend gaps 1–4 and 6).

## Global Constraints

- Scope: `convex/catalog/stock.ts` (new), `convex/analytics/**`, `convex/notifications/{emails,settings}.ts`, `convex/orders/desk.ts` (threshold import only), `scripts/send-test-admin-alert.ts`, `src/app/[locale]/admin/{page,analytics/page,settings/page,products/page}.tsx`, `src/components/admin/**` except `products/`, `src/components/admin/home/**`, `src/components/admin/settings/**`, `src/lib/admin/{homeView,soundPreference}.ts`, `src/hooks/useSoundPreference.ts`, `src/components/layout/{Navbar,MobileActionBar}.tsx`, `src/app/[locale]/account/orders/page.tsx`, `src/messages/{en,es}.json`. The Orders pages change only to delete the test-alert button.
- Pure modules in `src/lib/admin/` use relative imports (Vitest has no `@`/`@convex` alias) and import nothing from React or Convex.
- `LOW_STOCK_UNITS = 5`: low stock means `stock <= 5`. Defined once in `convex/catalog/stock.ts`.
- All copy under `admin.nav.*`, `admin.home.*`, `admin.settings.*`, `admin.common.*` in both `en.json` and `es.json`. Domain terms: Order, Needs Packing, Product, Cap, Heavyweight Tee, SKU, Apparel Colorway, Available Inventory.
- Home at `/[locale]/admin`; `/[locale]/admin/analytics` redirects there; Settings at `/[locale]/admin/settings`.
- Zero `any` in files this plan touches.
- Gates before every commit: `bun run test`, `bunx tsc --noEmit`, `bunx tsc --noEmit -p convex`. No migrations, no `convex run` against prod, no deploy.

## Review Focus

1. Local midnight: an order at 23:30 in New York (UTC−4) must bucket into that local day, not the next UTC day. → Task 2 test "buckets by the caller's local day".
2. A tee whose SKUs are all above the threshold but whose summed `stock` is ≤ 5 must not appear in low stock as a whole variant; only SKU rows count for tees. → Task 2 test "tees list SKUs, never the variant".
3. `ADMIN_NOTIFICATION_EMAIL` blank or malformed: Settings → Alerts must show the fallback address and say it is a fallback, never an empty string. → Task 3 test.
4. Sound preference changed on Settings must reach the layout's chime watcher in the same tab without a reload. → Task 8 test of `soundPreference.ts` listeners, plus the preview check.
5. `?attention` junk or missing analytics (query still loading) must render skeletons, not crash `toHomeVM`. → Task 5 test "handles undefined inputs".

---

### Task 1: One low-stock threshold

**Files:**
- Create: `convex/catalog/stock.ts`
- Modify: `convex/analytics/model.ts` (lines 19–22, 95, 147), `convex/analytics/model.test.ts:104-118`, `src/lib/admin/stockLevel.ts:4`
- Test: `convex/analytics/model.test.ts`

**Interfaces:**
- Produces: `export const LOW_STOCK_UNITS = 5;` in `convex/catalog/stock.ts`; `export function isLowStock(stock: number): boolean` (`stock <= LOW_STOCK_UNITS`).

- [ ] **Step 1: Change the attention test to the new threshold**

In `model.test.ts`, rename the test to `"counts the paid queue, overdue paid orders and low stock (≤ 5)"`, use `[variant("cap", 5), variant("tee", 6)]`, expect `lowStockCount: 1` and `lowStockVariants: [{ variantId: "cap", nameEn: "cap", nameEs: "cap", stock: 5 }]`.

- [ ] **Step 2: Run it to see it fail**

Run: `bunx vitest run convex/analytics/model.test.ts -t "≤ 5"`
Expected: FAIL, `lowStockCount` 0.

- [ ] **Step 3: Create `convex/catalog/stock.ts`, use it in `model.ts`**

Delete `ANALYTICS_LOW_STOCK_UNITS` and `ATTENTION_LOW_STOCK_UNITS`; both filters call `isLowStock(v.stock)`. `src/lib/admin/stockLevel.ts` keeps exporting `LOW_STOCK_THRESHOLD` but as `export const LOW_STOCK_THRESHOLD = 5; // mirrors convex/catalog/stock.ts LOW_STOCK_UNITS` (pure modules cannot import from `convex/`); add a test in `stockLevel.test.ts` that imports both and asserts equality via a relative path `../../../convex/catalog/stock` (plain constant file, no Convex imports, so Vitest can load it).

- [ ] **Step 4: Run the analytics and stockLevel tests**

Run: `bunx vitest run convex/analytics src/lib/admin/stockLevel.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add convex/catalog/stock.ts convex/analytics src/lib/admin/stockLevel.ts src/lib/admin/stockLevel.test.ts
git commit -m "refactor(stock): one low-stock threshold for admin, analytics and the badge"
```

### Task 2: Analytics reshaped for Home

**Files:**
- Modify: `convex/analytics/model.ts`, `convex/analytics/functions.ts`, `convex/analytics/model.test.ts`
- Test: `convex/analytics/model.test.ts`

**Interfaces:**
- Produces: `computeAnalytics(orders: Doc<"orders">[], allVariants: Doc<"variants">[], skus: Doc<"skus">[], now: number, tzOffsetMinutes: number)` returning
  ```ts
  {
    totalRevenue: number; completedOrdersCount: number; totalOrdersCount: number; aov: number;
    paymentStatusCounts; fulfillmentStatusCounts; cancelledCount;           // unchanged
    windows: { today: Window; d7: Window; d30: Window };                      // Window = { revenue: number; orders: number }
    dailySales: Array<{ date: string; revenue: number; orders: number }>;    // 30 entries, oldest first, local days "YYYY-MM-DD"
    topVariants;                                                             // unchanged, computed over the 30-day window only
    lowStock: Array<{ variantId: string; nameEn: string; nameEs: string; colorway?: string; size?: string; stock: number; image: string }>;
    inventorySummary;                                                        // unchanged
  }
  ```
  `getAnalyticsAdmin` args become `{ clientTime: number; tzOffsetMinutes: number }` (the browser's `new Date().getTimezoneOffset()`).
- Local day key: `new Date(ts - tzOffsetMinutes * 60_000).toISOString().slice(0, 10)`.

- [ ] **Step 1: Rewrite the `computeAnalytics` tests**

Replace the describe block's fixture call with `computeAnalytics(orders, variants, skus, NOW, 240)` (New York in October). Tests, with the existing fixture orders:
- `"counts revenue only from paid, uncancelled orders"`: `totalRevenue 648`, `completedOrdersCount 4`, `aov 162`; no `paymentBreakdown` key (`expect(result).not.toHaveProperty("paymentBreakdown")`).
- `"buckets by the caller's local day"`: an order at `Date.UTC(2026, 9, 17, 3)` (23:00 Oct 16 New York) with `tzOffsetMinutes 240` lands in `"2026-10-16"`; `dailySales.length === 30`; last entry's date is `"2026-10-17"`.
- `"sums today, 7-day and 30-day windows"`: with orders at `NOW`, `NOW - 3*DAY`, `NOW - 10*DAY`, `NOW - 40*DAY` (all paid, total 100): `windows.today.revenue 100`, `d7 200`, `d30 300`.
- `"tees list SKUs, never the variant"`: a tee variant `stock: 4, category: "apparel"` with skus `[{colorway:"black", size:"M", stock: 2}, {colorway:"black", size:"L", stock: 9}]` gives one `lowStock` row `{ variantId: "tee", colorway: "black", size: "M", stock: 2 }` and no row without `colorway`; a cap `stock: 3` gives a row without `colorway`/`size`. Sorted by stock ascending.
- Keep the axis, top-variants, archived and attention tests, updating signatures.

- [ ] **Step 2: Run to see them fail**

Run: `bunx vitest run convex/analytics/model.test.ts`
Expected: FAIL (arity, missing `windows`, missing `lowStock`).

- [ ] **Step 3: Implement in `model.ts`**

Remove the WhatsApp/Stripe split. Build 30 day keys ending at the local day of `now`. `windows` are sums over `dailySales` slices (today = last entry, d7 = last 7, d30 = all 30). `lowStock`: for each unarchived variant, if `v.category === "apparel"` push one row per SKU of that variant with `isLowStock(sku.stock)`, else one row when `isLowStock(v.stock)`; `image` is `v.catalogShot ?? v.image`. Update `analyticsValidator` to match (drop `paymentBreakdown` and `lowStockVariants`; add `windows`, `lowStock`).

- [ ] **Step 4: Update `functions.ts`**

Add `tzOffsetMinutes: v.number()` to args. Read SKUs: `const tees = variants.filter((v) => v.category === "apparel"); const skus = (await Promise.all(tees.map((v) => listSkus(ctx, v.variantId)))).flat();` (import `listSkus` from `../catalog/inventory`).

- [ ] **Step 5: Run tests and type checks**

Run: `bunx vitest run convex/analytics && bunx tsc --noEmit -p convex`
Expected: PASS; tsc reports only `src/app/[locale]/admin/analytics/page.tsx` (fixed in Task 5) — if it reports anything in `convex/`, fix it now.

- [ ] **Step 6: Commit**

```bash
git add convex/analytics
git commit -m "feat(analytics): 30 local days, today/7d/30d windows, tee SKU low stock; drop WhatsApp split"
```

### Task 3: Admin alert recipient query

**Files:**
- Create: `convex/notifications/settings.ts`, `convex/notifications/settings.test.ts`

**Interfaces:**
- Produces: `api.notifications.settings.getAdminRecipient` query, args `{}`, returns `{ email: string; fromEnv: boolean }` (admin only; `requireAdmin`). Uses `resolveAdminRecipient(process.env.ADMIN_NOTIFICATION_EMAIL, PRIMARY_ADMIN_EMAIL)`.

- [ ] **Step 1: Write the convex-test**

`setup()` as in `convex/settings/functions.test.ts`. Tests:
- `"falls back to the primary Administrator when the env var is unset"`: with `vi.stubEnv("ADMIN_NOTIFICATION_EMAIL", "")`, `admin.query(api.notifications.settings.getAdminRecipient, {})` equals `{ email: PRIMARY_ADMIN_EMAIL, fromEnv: false }`.
- `"returns the env address when valid"`: `vi.stubEnv("ADMIN_NOTIFICATION_EMAIL", "ops@example.com")` gives `{ email: "ops@example.com", fromEnv: true }`.
- `"rejects non-admins"`: `t.query(...)` without identity rejects.

- [ ] **Step 2: Run to see it fail**

Run: `bunx vitest run convex/notifications/settings.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `convex/notifications/settings.ts`**

- [ ] **Step 4: Run tests**

Run: `bunx vitest run convex/notifications/settings.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add convex/notifications/settings.ts convex/notifications/settings.test.ts
git commit -m "feat(notifications): read-only admin alert recipient for Settings"
```

### Task 4: Test alert moves to a script

**Files:**
- Modify: `convex/notifications/emails.ts:209-260` (`sendTestAdminOrderAlert`), `src/app/[locale]/admin/orders/page.tsx` (delete lines 169–187 and 407–420, the `Mail` import if unused)
- Create: `scripts/send-test-admin-alert.ts`
- Modify: `package.json` scripts: `"send-test-admin-alert": "bun run scripts/send-test-admin-alert.ts"`

**Interfaces:**
- `sendTestAdminOrderAlert` becomes `internalAction` (import from `../_generated/server`), no `requireAdminInAction` call, same args and return. Nothing else calls it (verified: only the orders page).

- [ ] **Step 1: Convert the action and delete the button**

- [ ] **Step 2: Write the script**

Same shape as `scripts/set-admin.ts`: parse `--prod` and an optional email; `Bun.spawnSync(["npx", "convex", "run", ...(prod ? ["--prod"] : []), "notifications/emails:sendTestAdminOrderAlert", JSON.stringify(email ? { targetEmail: email } : {})])`; print `Test alert sent to <recipient>.` Header comment with the two usage lines.

- [ ] **Step 3: Type check and run the unit suite**

Run: `bunx tsc --noEmit -p convex && bunx tsc --noEmit && bun run test`
Expected: PASS (the orders page no longer references `sendTestAlert`).

- [ ] **Step 4: Commit**

```bash
git add convex/notifications/emails.ts scripts/send-test-admin-alert.ts package.json "src/app/[locale]/admin/orders/page.tsx"
git commit -m "chore(admin): test order alert runs from a script, not the Orders page"
```

### Task 5: Home view model and page

**Files:**
- Create: `src/lib/admin/homeView.ts`, `src/lib/admin/homeView.test.ts`, `src/components/admin/home/HomePage.tsx`, `AttentionStrip.tsx`, `RevenueTiles.tsx`, `RevenueChart.tsx`, `LowStockList.tsx`, `BestSellers.tsx`, `HomeSkeleton.tsx`
- Move: `src/components/admin/products/QueryErrorBoundary.tsx` → `src/components/admin/QueryErrorBoundary.tsx` (update the import in `ProductGrid.tsx` and `ProductEditorPage.tsx` if present)
- Modify: `src/app/[locale]/admin/page.tsx` (renders `<HomePage />`), `src/app/[locale]/admin/analytics/page.tsx` (server redirect to `/${locale}/admin`)
- Delete: the old analytics page body

**Interfaces:**
- Consumes: Task 2's analytics shape; `getOrdersAttentionStats` result `{ totalActionRequired, overduePaid, lowStockCount }`.
- Produces in `homeView.ts`:
  ```ts
  export type AnalyticsInput = { windows; dailySales; lowStock; topVariants; fulfillmentStatusCounts: Record<string, number>; paymentStatusCounts: Record<string, number> };
  export type AttentionInput = { totalActionRequired: number; overduePaid: number; lowStockCount: number };
  export type HomeVM = {
    attention: Array<{ id: "needs_packing" | "overdue" | "problems" | "low_stock"; count: number; href: string; tone: "amber" | "rose" | "purple" | "zinc" }>;
    tiles: Array<{ id: "today" | "d7" | "d30"; revenueLabel: string; orders: number }>;
    chart: { bars: Array<{ date: string; label: string; revenue: number; orders: number; heightPct: number }> };
    lowStock: Array<{ key: string; name: string; detail?: string; stock: number; image: string; href: string }>;
    bestSellers: Array<{ rank: number; name: string; variantId: string; units: number; revenueLabel: string; image: string }>;
  };
  export function toHomeVM(analytics: AnalyticsInput, attention: AttentionInput, locale: "en" | "es"): HomeVM;
  ```
  Values: `problems = fulfillmentStatusCounts.delivery_exception + fulfillmentStatusCounts.returned + paymentStatusCounts.disputed`; hrefs `/admin/orders?queue=needs_packing`, `/admin/orders?queue=overdue`, `/admin/orders?queue=problems`, `/admin/products?stock=low`; tones amber / rose / purple / zinc, and `zinc` for any count of 0; `heightPct = max(4, round(revenue / maxRevenue * 100))`, 4 when `maxRevenue` is 0; chart `label` is the day number, with the weekday short name on Mondays (`toLocaleDateString(locale, …)`); `revenueLabel` via `Intl.NumberFormat(locale, { style: "currency", currency: "USD", maximumFractionDigits: 0 })`; low-stock `name` is `nameEn`/`nameEs` by locale, `detail` is `"${colorway} · ${size}"` when present, `href` `/admin/products/${variantId}`.

- [ ] **Step 1: Write `homeView.test.ts`**

Tones by id: `needs_packing` amber, `overdue` rose, `problems` purple, `low_stock` amber; any count of 0 is `zinc`. Tests: `"maps attention counts to queue links with tones"` (counts 3/1/0/2 → amber/rose/zinc/amber, hrefs as above); `"formats tiles in both locales"` (`$1,234` en, `US$1.234` or whatever `Intl` gives for es — assert with the same `Intl` call, not a literal); `"scales chart bars to the busiest day with a 4% floor"`; `"names tee SKUs with colorway and size"`; `"ranks best sellers from topVariants"`; `"problems sums exceptions, returns and disputes"`.

- [ ] **Step 2: Run to see it fail**

Run: `bunx vitest run src/lib/admin/homeView.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `homeView.ts`**

- [ ] **Step 4: Run tests**

Run: `bunx vitest run src/lib/admin/homeView.test.ts`
Expected: PASS.

- [ ] **Step 5: Build the components**

`HomePage` (client): `useMinuteClock()`, `tzOffsetMinutes = new Date().getTimezoneOffset()`, `useQuery(getAnalyticsAdmin, { clientTime, tzOffsetMinutes })`, `useQuery(getOrdersAttentionStats, { clientTime })`; while either is undefined render `HomeSkeleton`; otherwise `toHomeVM` and the five sections in spec order, wrapped in `QueryErrorBoundary` with the retry panel copy `admin.common.queryFailed` / `admin.common.retry`. Styling follows `ProductGrid.tsx` tokens (`bg-white dark:bg-[#0c0c14]`, `rounded-2xl`, `border-zinc-200 dark:border-white/[0.06]`). Attention strip: four pills in a horizontally scrolling row on phone, four columns at `sm`. Chart: 30 bars, `title` tooltip per bar. Low stock rows: `next/image` thumb 40 px, name, detail, stock pill (red at 0, amber otherwise), chevron link. No buttons on Home.

- [ ] **Step 6: Route files**

`admin/page.tsx`:
```tsx
import { HomePage } from "@/components/admin/home/HomePage";
export default function AdminHomePage() { return <HomePage />; }
```
`admin/analytics/page.tsx`: the existing `redirect` pattern from the old `admin/page.tsx`, pointing at `/${locale}/admin`.

- [ ] **Step 7: Type check and preview**

Run: `bunx tsc --noEmit`
Expected: PASS. Preview `/en/admin` and `/es/admin` at phone and desktop widths: strip, tiles, chart, low stock (a tee SKU row visible when one is ≤ 5), best sellers; `/en/admin/analytics` lands on `/en/admin`.

- [ ] **Step 8: Commit**

```bash
git add src/lib/admin/homeView.ts src/lib/admin/homeView.test.ts src/components/admin/home src/components/admin/QueryErrorBoundary.tsx src/components/admin/products "src/app/[locale]/admin/page.tsx" "src/app/[locale]/admin/analytics/page.tsx"
git commit -m "feat(admin): Home replaces Analytics"
```

### Task 6: Sound preference as a shared module

**Files:**
- Create: `src/lib/admin/soundPreference.ts`, `src/lib/admin/soundPreference.test.ts`, `src/hooks/useSoundPreference.ts`
- Modify: `src/components/admin/AdminConsoleLayout.tsx` (replace the inline `useState` + `localStorage` block)

**Interfaces:**
- `soundPreference.ts`: `export const SOUND_PREF_KEY = "moya_admin_sound";` `export function readSoundPreference(storage: Pick<Storage, "getItem"> | null): boolean` (null/missing → `true`; `"false"` → false); `export function writeSoundPreference(storage: Pick<Storage, "setItem">, enabled: boolean): void`; `export function subscribeSoundPreference(target: EventTarget, cb: (enabled: boolean) => void): () => void` listening for a `CustomEvent<boolean>` named `"moya-admin-sound"`; `writeSoundPreference` also dispatches that event on `globalThis` when it exists.
- `useSoundPreference(): [enabled: boolean, setEnabled: (v: boolean) => void]` wraps the above with `useSyncExternalStore` or state + subscribe.

- [ ] **Step 1: Write `soundPreference.test.ts`**

`"defaults to enabled when nothing is stored"`, `"reads false"`, `"write stores and notifies subscribers in the same tab"` (use a fake storage object and an `EventTarget`).

- [ ] **Step 2: Run to see it fail** — `bunx vitest run src/lib/admin/soundPreference.test.ts`, FAIL.

- [ ] **Step 3: Implement the module and the hook; wire the layout to the hook** (the layout keeps `playOrderChime` and its watcher effect; the toggle buttons go away here and return in Task 7's Settings → Alerts).

- [ ] **Step 4: Run tests** — PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/admin/soundPreference.ts src/lib/admin/soundPreference.test.ts src/hooks/useSoundPreference.ts src/components/admin/AdminConsoleLayout.tsx
git commit -m "refactor(admin): order chime preference as a shared module"
```

### Task 7: Settings page

**Files:**
- Create: `src/app/[locale]/admin/settings/page.tsx`, `src/components/admin/settings/SettingsPage.tsx`, `AlertsCard.tsx`, `AccountCard.tsx`
- Modify: `src/app/[locale]/admin/products/page.tsx` (remove `CategoryLaunchCard`), `src/components/admin/StoreSettingsCard.tsx` (no logic change; copy keys move under `admin.settings.shipping.*`)

**Interfaces:**
- Consumes: Task 3's `getAdminRecipient`; Task 6's `useSoundPreference`; existing `StoreSettingsCard`, `CategoryLaunchCard`, `ThemeToggle`, `SafeUserButton`, `useRouter`/`usePathname` from `@/i18n/routing` for the locale switch.
- `SettingsPage` renders, in order: `StoreSettingsCard`, `CategoryLaunchCard`, `AlertsCard`, `AccountCard`, each a `section` with `h2` from `admin.settings.{shipping,launch,alerts,account}.title`.
- `AlertsCard`: recipient line `admin.settings.alerts.recipient` with the email; when `fromEnv === false`, a muted line `admin.settings.alerts.fallback` ("Set ADMIN_NOTIFICATION_EMAIL on the Convex deployment to change it."); chime toggle as a labelled switch (`role="switch"`, `aria-checked`), label `admin.settings.alerts.chime`.
- `AccountCard`: EN/ES segmented control (moved from the sidebar footer, same `switchLocale`), `ThemeToggle`, `SafeUserButton`.

- [ ] **Step 1: Build the four files and the route** (`settings/page.tsx` renders `<SettingsPage />`).

- [ ] **Step 2: Remove `CategoryLaunchCard` from the Products page** (keep the `Suspense` grid).

- [ ] **Step 3: Type check and preview**

Run: `bunx tsc --noEmit`
Expected: PASS. Preview `/en/admin/settings`: save shipping rules; change a category status; flip the chime switch and confirm the sidebar watcher honours it (Task 6 event); switch to ES and confirm every label changes.

- [ ] **Step 4: Commit**

```bash
git add "src/app/[locale]/admin/settings" src/components/admin/settings "src/app/[locale]/admin/products/page.tsx" src/components/admin/StoreSettingsCard.tsx
git commit -m "feat(admin): Settings page with shipping, category launch, alerts and account"
```

### Task 8: Shell, admin bar and storefront links

**Files:**
- Modify: `src/components/admin/AdminConsoleLayout.tsx`, `src/components/admin/AdminQuickBar.tsx`, `src/components/layout/Navbar.tsx:138,233`, `src/components/layout/MobileActionBar.tsx:73`, `src/app/[locale]/account/orders/page.tsx:195`

**Interfaces:**
- `navItems` in the layout: `home` (`/admin`, `Home` icon from lucide), `orders` (`/admin/orders`, badge), `products`, `drops`, `settings` (`Settings` icon). Active = `pathname === href` for `/admin`, `pathname.startsWith(href)` for the rest. Labels `t("nav.*")`.
- Brand header: `BrandMark` + "GOOD LUCK" only. Footer: `Storefront ↗` (`t("backToStore")`) and `SafeUserButton`. No STAFF pill, no section headings, no "Convex Reactive", no locale or theme controls (moved to Settings → Account), no sound button.
- Phone header: menu button with the attention dot, brand, `SafeUserButton`. Phone menu: the five links.
- `AdminQuickBar`: `useState(true)` for `minimized`; the minimized pill links to `/admin`; the expanded card's button links to `/admin`.

- [ ] **Step 1: Edit the layout, the bar and the five links.**

- [ ] **Step 2: Type check and preview**

Run: `bunx tsc --noEmit`
Expected: PASS. Preview at phone and desktop, light and dark, `/es/admin`: no English chrome; Orders badge still counts; storefront Navbar admin link opens `/admin`.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/AdminConsoleLayout.tsx src/components/admin/AdminQuickBar.tsx src/components/layout/Navbar.tsx src/components/layout/MobileActionBar.tsx "src/app/[locale]/account/orders/page.tsx"
git commit -m "feat(admin): five-item sidebar, quiet admin bar, Home links"
```

### Task 9: Copy in both locales and final gates

**Files:**
- Modify: `src/messages/en.json`, `src/messages/es.json`

**Interfaces:**
- Add `admin.nav.home`; `admin.home.{title, attention.{needs_packing, overdue, problems, low_stock}, tiles.{today, d7, d30, orders}, chart.{title, subtitle}, lowStock.{title, empty, edit}, bestSellers.{title, empty, units}}`; `admin.settings.{title, shipping.*, launch.title (reuse admin.launch), alerts.{title, recipient, fallback, chime, chimeOn, chimeOff}, account.{title, language, theme}}`; `admin.common.{queryFailed, retry, showingLatest}`.
- Remove `admin.metrics.*`, `admin.subtitle`, `admin.nav.analytics` (grep for callers first: expected none after Tasks 5–8).
- `admin.nav.orders` → "Orders" / "Órdenes"; `admin.nav.products` → "Products" / "Productos"; `admin.nav.drops` → "Drops" / "Drops"; `admin.backToStore` → "Storefront" / "Tienda".

- [ ] **Step 1: Add and remove keys in both files; run a key-parity check**

Run: `bun -e 'const a=Object.keys(flat(require("./src/messages/en.json").admin)),b=Object.keys(flat(require("./src/messages/es.json").admin));function flat(o,p=""){return Object.entries(o).reduce((m,[k,v])=>typeof v==="object"?{...m,...flat(v,p+k+".")}:{...m,[p+k]:1},{})}console.log(a.filter(k=>!b.includes(k)),b.filter(k=>!a.includes(k)))'`
Expected: `[] []`.

- [ ] **Step 2: Grep for dead keys**

Run: `grep -rn "admin.metrics\|nav.analytics\|\"metrics\." src | grep -v messages`
Expected: no output.

- [ ] **Step 3: Full gates**

Run: `bun run test && bunx tsc --noEmit && bunx tsc --noEmit -p convex`
Expected: all PASS.

- [ ] **Step 4: Preview walk-through** at `/en/admin`, `/es/admin`, `/en/admin/settings`, phone width, dark mode; screenshot Home and Settings.

- [ ] **Step 5: Commit**

```bash
git add src/messages/en.json src/messages/es.json
git commit -m "feat(admin): Home, Settings and nav copy in English and Spanish"
```
