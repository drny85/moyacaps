# Photo Autofill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On `/admin/products/new`, an Administrator drops up to four photos of a Cap or Heavyweight Tee and gets the empty form fields proposed for review: category, Silhouette, colors, bilingual names and copy, slug and the category's default price.

**Architecture:** The browser downscales the photos and sends them to one Next.js server action. The action checks the admin, reads catalog context from Convex, and calls a vision model through the Vercel AI Gateway with AI SDK 7 `generateText` + `Output.object`. It returns one structured proposal. A pure merge module turns that proposal into form values, filling only empty fields. Nothing is saved until the Administrator presses Save (the existing `createVariant`).

**Tech Stack:** Next.js 16 App Router (server action), AI SDK `ai@7.0.148` (AI Gateway via plain `"provider/model"` strings), zod 4, Clerk, Convex, vitest (`edge-runtime`), next-intl.

**Spec:** `CONTEXT.md` ("Photo Autofill"), `docs/adr/0027-photo-autofill-in-a-nextjs-server-action.md`. The settled decisions are restated in Global Constraints below.

## Global Constraints

- Only `/admin/products/new` gets Photo Autofill. The edit page does not.
- 1–4 photos per run. Each photo is downscaled in the browser to at most 1568 px on the long side, as JPEG at quality 0.85, before sending.
- The photos are never stored (not in Convex storage, not in logs). They are used for the proposal only.
- The AI proposes: `category`, `silhouette`, `primaryHex`, `secondaryHex`, `nameEn`, `nameEs`, `variantId` (slug), `descriptionEn`, `descriptionEs`, and for tees `colorways`, `fabricEn`, `fabricEs`, `fitEn`, `fitEs`.
- The AI never sets `stock`, `sizes`, `isFeatured`, `isAvailable`, `badgeTextEn/Es`, `taxCode` or `priceUsd`.
- Default price per category is a constant, not an AI output: `DEFAULT_PRICE_USD = { headwear: 120, apparel: 80 }` in `convex/catalog/rules.ts`. The plain form starts at it too.
- The merge fills empty fields only. A field the Administrator typed is never overwritten. An AI-filled field shows a marker until its value changes.
- One structured result, not a stream.
- `recognized: "cap" | "tee" | "other"`. On `"other"` nothing is filled and the `note` is shown.
- An off-catalog silhouette maps to the closest allowed one (`snapback`, `trucker`, `tee`) and the `note` says so.
- Tee colorways reuse an existing Apparel Colorway (same `id`, names, `hex`, `borderHex`) when one matches. A new one is created only when none matches.
- A taken slug gets `-2`, `-3`, … appended, checked against the admin product list already loaded on the page.
- Model: `process.env.PRODUCT_AUTOFILL_MODEL ?? "anthropic/claude-sonnet-5-5"`, through the AI Gateway (OIDC on Vercel; `vercel env pull` locally).
- Auth: Clerk session plus `api.users.functions.amIAdmin` via the Convex JWT (`template: "convex"`). A non-admin gets an error before any model call.
- Copy rules in the prompt: use the CONTEXT.md vocabulary (Cap not hat/sombrero, Heavyweight Tee not shirt, Colorway, Silhouette). Spanish copy is natural Latin American Spanish, not a literal translation.
- Field limits come from `PRODUCT_LIMITS` (name 80, description 1000) and the slug rules in `validateProductFields`. The proposal is clipped to them before merging.
- CI makes no real model calls. Tests use `MockLanguageModelV4` from `ai/test`.
- Engineering standard: pure modules with unit tests; the UI stays a thin shell.

## Review Focus

1. **The Administrator typed fields before running Photo Autofill**: those values survive untouched, including a hand-picked category whose page `?category=` differs from what the AI detected. A typed category wins over the detected one. Test in Task 4.
2. **The AI returns a value that fails validation** (a 3-digit or invalid hex, a name over 80 chars, a slug with uppercase or spaces): the merge clips or normalizes it, or leaves the field empty. It never puts a value in the form that `validateForm` would reject for format. Test in Task 4.
3. **Running Photo Autofill twice**: the second run fills only fields that are still empty, and the markers still point at the values that are currently AI-filled. Test in Task 4.
4. **The model call fails or times out** (gateway error, no OIDC token locally): the panel shows an error and the form is unchanged and still usable by hand. Test in Task 5.
5. **A HEIC or very large phone photo**: the browser downscale produces a JPEG under the limit, and a file that isn't an image is rejected before any upload. Test in Task 3 (size math and type check).

---

## File Structure

| File | Responsibility |
| --- | --- |
| `convex/catalog/rules.ts` (modify) | `DEFAULT_PRICE_USD` next to `DEFAULT_TAX_CODE` |
| `src/lib/admin/productForm.ts` (modify) | `emptyForm` and `withCategory` use the default price |
| `src/lib/admin/photoAutofill/schema.ts` | zod schema of the AI proposal plus its TS type |
| `src/lib/admin/photoAutofill/context.ts` | Builds `AutofillCatalogContext` (colorways, example copy, taken slugs) from admin rows |
| `src/lib/admin/photoAutofill/prompt.ts` | System prompt from the context |
| `src/lib/admin/photoAutofill/merge.ts` | Proposal + form + context → new form, plus the list of AI-filled fields |
| `src/lib/admin/photoAutofill/photos.ts` | Photo checks and downscale size math (pure) plus the browser `downscalePhoto` |
| `src/lib/server/photoAutofill.ts` | `runPhotoAutofill(deps, input)`: admin gate, model call, typed result (testable core) |
| `src/app/actions/photoAutofill.ts` | `"use server"` wrapper wiring Clerk, Convex and the gateway model into the core |
| `src/components/admin/products/PhotoAutofillPanel.tsx` | Drop zone, thumbnails, run button, loading/error/note states |
| `src/components/admin/products/useProductEditor.ts` (modify) | `applyAutofill(proposal)` and the `aiFilled` list |
| `src/components/admin/products/DetailsSection.tsx`, `PricingStockSection.tsx`, `TeeOptionsEditor.tsx` (modify) | "AI" marker next to filled fields |
| `src/components/admin/products/ProductEditorPage.tsx` (modify) | Mount the panel when `isNew` |
| `src/messages/en.json`, `src/messages/es.json` (modify) | `admin.products.autofill.*` strings |
| `next.config.mjs`, `.env.example`, `docs/plans/README.md` (modify) | Body limit, env var, plan row |

---

### Task 1: Default price per category

**Files:**
- Modify: `convex/catalog/rules.ts` (after `DEFAULT_TAX_CODE`)
- Modify: `src/lib/admin/productForm.ts` (`emptyForm`, `withCategory`)
- Test: `src/lib/admin/productForm.test.ts`

**Interfaces:**
- Produces: `export const DEFAULT_PRICE_USD: Record<Category, number> = { headwear: 120, apparel: 80 }`. `emptyForm(category).priceUsd === String(DEFAULT_PRICE_USD[category])`.

- [ ] **Step 1: Write the failing tests**

```ts
describe("default price", () => {
  it("starts a new Cap at 120 and a new Tee at 80", () => {
    expect(emptyForm("headwear").priceUsd).toBe("120");
    expect(emptyForm("apparel").priceUsd).toBe("80");
  });
  it("switches the price with the category while it is still the default", () => {
    expect(withCategory(emptyForm("headwear"), "apparel").priceUsd).toBe("80");
  });
  it("keeps a typed price across a category switch", () => {
    expect(withCategory({ ...emptyForm("headwear"), priceUsd: "95" }, "apparel").priceUsd).toBe("95");
  });
});
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `bunx vitest run src/lib/admin/productForm.test.ts`
Expected: FAIL. The first test gets `""`, not `"120"`.

- [ ] **Step 3: Implement**

Add `DEFAULT_PRICE_USD` to `rules.ts`. In `emptyForm`, set `priceUsd: String(DEFAULT_PRICE_USD[category])`. In `withCategory`, switch the price the same way `taxCode` switches: only when `form.priceUsd === String(DEFAULT_PRICE_USD[form.category])`. Fix any existing test that expected `priceUsd: ""`.

- [ ] **Step 4: Run the full suite**

Run: `bun run test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add convex/catalog/rules.ts src/lib/admin/productForm.ts src/lib/admin/productForm.test.ts
git commit -m "feat(admin): default price per category (Cap 120, Tee 80)"
```

---

### Task 2: Proposal schema, catalog context and prompt

**Files:**
- Create: `src/lib/admin/photoAutofill/schema.ts`, `context.ts`, `prompt.ts`
- Test: `src/lib/admin/photoAutofill/context.test.ts`, `prompt.test.ts`
- Modify: `package.json` (`bun add ai@7.0.148`)

**Interfaces:**
- Produces (`schema.ts`):
  ```ts
  export const autofillProposalSchema = z.object({
    recognized: z.enum(["cap", "tee", "other"]),
    note: z.string().describe("One short sentence for the Administrator; empty when nothing to flag"),
    silhouette: z.enum(["snapback", "trucker", "tee"]),
    primaryHex: z.string().describe("#rrggbb. Cap: crown color. Tee: card swatch color"),
    secondaryHex: z.string().describe("#rrggbb. Cap: visor/accent color. Tee: swatch border"),
    nameEn: z.string(), nameEs: z.string(),
    slug: z.string(),
    descriptionEn: z.string(), descriptionEs: z.string(),
    colorways: z.array(z.object({ id: z.string(), nameEn: z.string(), nameEs: z.string(), hex: z.string(), borderHex: z.string() })),
    fabricEn: z.string(), fabricEs: z.string(), fitEn: z.string(), fitEs: z.string(),
  });
  export type AutofillProposal = z.infer<typeof autofillProposalSchema>;
  ```
  Tee-only fields are `""`/`[]` for a cap. All fields are required, so the provider's structured output stays strict. `category` is derived (`cap → headwear`, `tee → apparel`), not asked.
- Produces (`context.ts`):
  ```ts
  export type AutofillCatalogContext = {
    colorways: TeeColorwayInput[];          // unique by id, from every tee row
    examples: { category: Category; nameEn: string; nameEs: string; descriptionEn: string; descriptionEs: string }[]; // ≤ 3, non-archived rows with both descriptions, newest first
    takenSlugs: string[];
  };
  export function catalogContextFrom(rows: ResolvedVariant[]): AutofillCatalogContext;
  ```
- Produces (`prompt.ts`): `export function buildAutofillSystemPrompt(ctx: AutofillCatalogContext): string`.

- [ ] **Step 1: Write the failing tests** (use `src/lib/admin/productFixtures.ts` for rows)
  - `catalogContextFrom`: dedupes colorways by `id`; takes at most 3 examples, skips archived rows and rows missing either description; `takenSlugs` includes archived rows' `variantId`.
  - `buildAutofillSystemPrompt`:
    - contains every colorway `id` and `nameEn`, and each example's `descriptionEn`;
    - contains the phrases `"Cap"`, `"Heavyweight Tee"` and `"never call it a hat"`;
    - contains `"snapback"`, `"trucker"` and `"tee"`;
    - mentions `"recognized"` and `"other"`;
    - works with an empty context and still includes the vocabulary rules.

- [ ] **Step 2: Run them and confirm they fail**

Run: `bunx vitest run src/lib/admin/photoAutofill`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

`bun add ai@7.0.148`, then write the three modules. The prompt must cover the following, in this order:
1. role: catalog copywriter for Good Luck caps and tees;
2. vocabulary rules from CONTEXT.md (Cap, Heavyweight Tee, Colorway, Silhouette and their `_Avoid_` words);
3. silhouette mapping: a non-mesh structured cap → `snapback`, a mesh back → `trucker`, any tee → `tee`, anything off-catalog → closest, plus a `note`;
4. `other` rule: the photo is not a cap or tee;
5. "reuse an existing colorway's exact id, names, hex and borderHex when it matches";
6. the example descriptions, as voice samples;
7. limits: names ≤ 80 chars, descriptions ≤ 1000, slug lowercase-hyphenated;
8. Spanish quality: natural, not literal.

Read `node_modules/ai/docs/03-ai-sdk-core/10-generating-structured-data.mdx` before writing the schema.

- [ ] **Step 4: Run tests**

Run: `bunx vitest run src/lib/admin/photoAutofill`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add package.json bun.lock package-lock.json src/lib/admin/photoAutofill
git commit -m "feat(admin): Photo Autofill proposal schema, catalog context and prompt"
```

---

### Task 3: Photo checks and downscale

**Files:**
- Create: `src/lib/admin/photoAutofill/photos.ts`
- Test: `src/lib/admin/photoAutofill/photos.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export const AUTOFILL_MAX_PHOTOS = 4;
  export const AUTOFILL_LONG_SIDE = 1568;
  export const AUTOFILL_JPEG_QUALITY = 0.85;
  export type PhotoCheck = { ok: true } | { ok: false; reason: "not_image" | "too_many" | "none" };
  export function checkPhotos(files: { type: string }[]): PhotoCheck;      // pure
  export function fitWithin(w: number, h: number, longSide: number): { width: number; height: number }; // pure, never upscales, rounds
  export async function downscalePhoto(file: File): Promise<Blob>;          // browser only: createImageBitmap + OffscreenCanvas → image/jpeg
  ```

- [ ] **Step 1: Write the failing tests** (pure functions only)
  - `fitWithin(4032, 3024, 1568)` → `{ width: 1568, height: 1176 }`.
  - `fitWithin(3024, 4032, 1568)` → `{ width: 1176, height: 1568 }`.
  - `fitWithin(800, 600, 1568)` → `{ width: 800, height: 600 }` (no upscale).
  - `checkPhotos([])` → `none`.
  - Five images → `too_many`.
  - `[{ type: "application/pdf" }]` → `not_image`.
  - `[{ type: "image/heic" }]` → `ok`. The browser decodes HEIC when it can; a decode failure surfaces as the panel's error.

- [ ] **Step 2: Run them and confirm they fail.** Run: `bunx vitest run src/lib/admin/photoAutofill/photos.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement.** `downscalePhoto` uses `fitWithin(bitmap.width, bitmap.height, AUTOFILL_LONG_SIDE)` and `canvas.convertToBlob({ type: "image/jpeg", quality: AUTOFILL_JPEG_QUALITY })`.

- [ ] **Step 4: Run tests.** Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/admin/photoAutofill/photos.ts src/lib/admin/photoAutofill/photos.test.ts
git commit -m "feat(admin): Photo Autofill photo checks and downscale"
```

---

### Task 4: Merge the proposal into the form

**Files:**
- Create: `src/lib/admin/photoAutofill/merge.ts`
- Test: `src/lib/admin/photoAutofill/merge.test.ts`

**Interfaces:**
- Consumes: `AutofillProposal` (Task 2), `AutofillCatalogContext` (Task 2), `ProductFormState`, `emptyForm`, `withCategory`, `suggestVariantId` (`productForm.ts`), `PRODUCT_LIMITS`, `normalizeSlug`, `DEFAULT_PRICE_USD` (`rules.ts`).
- Produces:
  ```ts
  export type AutofillField = "category" | "silhouette" | "primaryHex" | "secondaryHex" | "nameEn" | "nameEs" | "variantId"
    | "descriptionEn" | "descriptionEs" | "colorways" | "fabricEn" | "fabricEs" | "fitEn" | "fitEs";
  export type AutofillOutcome =
    | { kind: "unrecognized"; note: string }
    | { kind: "applied"; form: ProductFormState; filled: Partial<Pick<ProductFormState, AutofillField>>; note: string };
  export function applyAutofill(form: ProductFormState, proposal: AutofillProposal, ctx: AutofillCatalogContext, categoryTouched: boolean): AutofillOutcome;
  /** Fields still showing the AI marker: the form value still equals the value autofill put there (deep-equal for colorways). */
  export function aiFilledFields(form: ProductFormState, filled: Partial<Pick<ProductFormState, AutofillField>>): AutofillField[];
  ```

**Rules `applyAutofill` follows:**
- "Empty" means:
  - a string field that is `""` after trim;
  - `colorways` with length 0;
  - `primaryHex`/`secondaryHex` still at the `emptyForm` defaults (`#000000`/`#ffffff`);
  - `silhouette` still at the category's first silhouette.
- Category comes from `recognized`. Apply it with `withCategory`, which also moves the default price, unless `categoryTouched` is true. If the Administrator chose the category and the AI disagrees, keep theirs and append to `note`.
- A hex that doesn't match `#rrggbb` (case-insensitive; a `#rgb` value is expanded) is dropped and the field stays empty.
- Names are trimmed and clipped to `PRODUCT_LIMITS.name`; descriptions to `PRODUCT_LIMITS.description`.
- Slug: start from `normalizeSlug(proposal.slug)`, or `suggestVariantId(nameEn)` when that is empty. Clip it to `PRODUCT_LIMITS.slug`. If it is in `ctx.takenSlugs`, append `-2`, `-3`, … until it is free.
- Colorways (tee only): a proposal colorway whose `id` is in `ctx.colorways` is replaced by the stored one verbatim. A new one keeps its fields, with `id` normalized by `normalizeSlug`. Duplicates by `id` are dropped.
- Tee-only fields are ignored for a cap.

- [ ] **Step 1: Write the failing tests**

```ts
it("fills an empty Cap form and keeps the default price", () => {
  const out = applyAutofill(emptyForm("headwear"), capProposal, ctx, false);
  expect(out.kind).toBe("applied");
  if (out.kind !== "applied") return;
  expect(out.form.nameEn).toBe(capProposal.nameEn);
  expect(out.form.priceUsd).toBe("120");
  expect(out.form.silhouette).toBe("trucker");
});
it("switches to apparel and its default price when a tee is recognized", () => {
  const out = applyAutofill(emptyForm("headwear"), teeProposal, ctx, false);
  expect(out.kind === "applied" && out.form.category).toBe("apparel");
  expect(out.kind === "applied" && out.form.priceUsd).toBe("80");
});
it("never overwrites a typed field", () => {
  const typed = { ...emptyForm("headwear"), nameEn: "My Name", descriptionEs: "Mía" };
  const out = applyAutofill(typed, capProposal, ctx, false);
  expect(out.kind === "applied" && out.form.nameEn).toBe("My Name");
  expect(out.kind === "applied" && out.form.descriptionEs).toBe("Mía");
  expect(out.kind === "applied" && "nameEn" in out.filled).toBe(false);
});
it("keeps a category the Administrator chose and says so in the note", () => {
  const out = applyAutofill(emptyForm("apparel"), capProposal, ctx, true);
  expect(out.kind === "applied" && out.form.category).toBe("apparel");
  expect(out.kind === "applied" && out.note).not.toBe("");
});
it("fills nothing for an unrecognized photo", () => {
  expect(applyAutofill(emptyForm("headwear"), { ...capProposal, recognized: "other", note: "A dog" }, ctx, false))
    .toEqual({ kind: "unrecognized", note: "A dog" });
});
it("drops an invalid hex and expands a short one", () => { /* "red" → stays "#000000" not in filled; "#abc" → "#aabbcc" */ });
it("clips names to 80 and descriptions to 1000", () => { /* 200-char name → length 80 */ });
it("suffixes a taken slug", () => { /* takenSlugs ["black-cap","black-cap-2"], slug "Black Cap" → "black-cap-3" */ });
it("reuses a stored colorway by id and normalizes a new one", () => { /* stored id "vintage-black" replaced verbatim; new id "Sky Blue" → "sky-blue" */ });
it("ignores tee fields for a cap", () => { /* fabricEn stays "" */ });
it("fills only still-empty fields on a second run", () => { /* run twice, second run on first's form: filled is empty */ });
it("aiFilledFields drops a field once the Administrator edits it", () => {
  const out = applyAutofill(emptyForm("headwear"), capProposal, ctx, false);
  if (out.kind !== "applied") throw new Error();
  expect(aiFilledFields({ ...out.form, nameEn: "Edited" }, out.filled)).not.toContain("nameEn");
});
it("never puts a value in the form that validateForm rejects for format", () => {
  const out = applyAutofill(emptyForm("headwear"), capProposal, ctx, false);
  expect(out.kind === "applied" && validateForm(out.form).filter((e) => e.code === "format")).toEqual([]);
});
```

- [ ] **Step 2: Run them and confirm they fail.** Run: `bunx vitest run src/lib/admin/photoAutofill/merge.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement `applyAutofill` and `aiFilledFields`** in `merge.ts`, following the rules above.

- [ ] **Step 4: Run tests.** Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/admin/photoAutofill/merge.ts src/lib/admin/photoAutofill/merge.test.ts
git commit -m "feat(admin): merge a Photo Autofill proposal into empty form fields"
```

---

### Task 5: Server action

**Files:**
- Create: `src/lib/server/photoAutofill.ts`, `src/app/actions/photoAutofill.ts`
- Test: `src/lib/server/photoAutofill.test.ts`
- Modify: `next.config.mjs` (`experimental.serverActions.bodySizeLimit: "4mb"`), `.env.example` (`PRODUCT_AUTOFILL_MODEL=` with a comment naming the default)

**Interfaces:**
- Consumes: `autofillProposalSchema`, `catalogContextFrom`, `buildAutofillSystemPrompt` (Task 2), `checkPhotos`, `AUTOFILL_MAX_PHOTOS` (Task 3).
- Produces:
  ```ts
  // src/lib/server/photoAutofill.ts (no "use server"; import "server-only")
  export type AutofillDeps = {
    isAdmin: () => Promise<boolean>;
    loadRows: () => Promise<ResolvedVariant[]>;
    model: LanguageModel;                       // from "ai"
  };
  export type AutofillResponse =
    | { ok: true; proposal: AutofillProposal; context: AutofillCatalogContext }
    | { ok: false; error: "forbidden" | "bad_photos" | "model_failed" };
  export async function runPhotoAutofill(deps: AutofillDeps, photos: { data: Uint8Array; mediaType: string }[]): Promise<AutofillResponse>;

  // src/app/actions/photoAutofill.ts
  "use server";
  export async function photoAutofill(formData: FormData): Promise<AutofillResponse>; // field "photos": Blob[]
  ```

**Behavior:**
- `runPhotoAutofill` checks admin first and returns `forbidden` without loading rows or calling the model.
- It then checks photos with `checkPhotos`, and also rejects any photo over 1.5 MB as `bad_photos`.
- It calls `generateText({ model, system: buildAutofillSystemPrompt(ctx), output: Output.object({ schema: autofillProposalSchema }), messages: [{ role: "user", content: [{ type: "text", text: "Propose the product fields for these photos." }, ...photos.map((p) => ({ type: "file", mediaType: p.mediaType, data: p.data }))] }], maxRetries: 1, abortSignal: AbortSignal.timeout(60_000) })`.
- Any thrown error becomes `model_failed`. Log it with `console.error` without photo bytes.
- It returns `context` so the client merges with the same slugs and colorways the prompt saw.
- The wrapper:
  - `isAdmin`: `const token = await (await auth()).getToken({ template: "convex" })`, then `fetchQuery(api.users.functions.amIAdmin, {}, { token })`. A null token → `false`.
  - `loadRows`: `fetchQuery(api.catalog.admin.getAllProductsAdmin, { includeArchived: true }, { token })` → `.variants`.
  - `model`: `process.env.PRODUCT_AUTOFILL_MODEL ?? "anthropic/claude-sonnet-5-5"`, passed as a plain string. Check `node_modules/ai/docs/03-ai-sdk-core/45-provider-management.mdx` that strings route through the gateway; if `LanguageModel` needs an object, use `gateway(id)` from `ai`.

- [ ] **Step 1: Write the failing tests** with `MockLanguageModelV4` from `ai/test`, returning `content: [{ type: "text", text: JSON.stringify(capProposal) }]`:
  - a non-admin → `{ ok: false, error: "forbidden" }`, and the mock's `doGenerate` is never called (`vi.fn`);
  - zero photos or five photos → `bad_photos`;
  - a 2 MB photo → `bad_photos`;
  - an admin with one photo → `ok: true`, `proposal` equals `capProposal`, `context.takenSlugs` holds the rows' ids;
  - the mock receives a `file` part with `mediaType: "image/jpeg"` and a system prompt containing a stored colorway id;
  - `doGenerate` throws → `model_failed`;
  - the mock returns non-JSON text → `model_failed`.

- [ ] **Step 2: Run them and confirm they fail.** Run: `bunx vitest run src/lib/server/photoAutofill.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement both files, and set `bodySizeLimit: "4mb"`** under `experimental.serverActions` in `next.config.mjs`. Four 1.5 MB photos plus multipart overhead is under 4.5 MB on Vercel.

- [ ] **Step 4: Run tests and typecheck**

Run: `bun run test && bunx tsc --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/photoAutofill.ts src/lib/server/photoAutofill.test.ts src/app/actions/photoAutofill.ts next.config.mjs .env.example
git commit -m "feat(admin): Photo Autofill server action via AI Gateway"
```

---

### Task 6: Editor panel, markers and copy

**Files:**
- Create: `src/components/admin/products/PhotoAutofillPanel.tsx`
- Modify: `useProductEditor.ts`, `ProductEditorPage.tsx`, `DetailsSection.tsx`, `PricingStockSection.tsx`, `TeeOptionsEditor.tsx`, `src/messages/en.json`, `src/messages/es.json`

**Interfaces:**
- Consumes: `photoAutofill` (Task 5), `applyAutofill`, `aiFilledFields`, `AutofillField` (Task 4), `checkPhotos`, `downscalePhoto`, `AUTOFILL_MAX_PHOTOS` (Task 3).
- Produces in `useProductEditor`:
  - `applyAutofillProposal(proposal: AutofillProposal, ctx: AutofillCatalogContext): AutofillOutcome`. It edits through the existing `edit` reducer action, so unsaved-changes tracking and the navigation guard still work, and stores `filled` in state, merging it with earlier runs.
  - `aiFilled: AutofillField[]`, which is `aiFilledFields(form, filled)`.
  - `categoryTouched: boolean`, which is true once `setCategory` has been called in this session.

**Panel states:**
- `idle`: drop zone plus a file input (`accept="image/*"`, `multiple`, `capture` not set), with thumbnails of the selected photos (object URLs, revoked on unmount).
- `working`: a spinner with "Reading your photos…". The form is not disabled.
- `error`: `forbidden`, `bad_photos`, `model_failed` or a downscale failure, each with its own message.
- `note`: shown after an `applied` run when the note isn't empty.
- `unrecognized`: shows the note, and nothing is filled.

The run button is disabled while working and when `checkPhotos` fails. After `applied`, the photos clear. Each field label in `aiFilled` gets a small "AI" pill (`aria-label` "Filled by Photo Autofill"). Mount the panel above the form sections only when `editor.isNew`.

**Strings** (`admin.products.autofill.*`, EN and ES): `title`, `hint` ("Up to 4 photos. We fill empty fields; you review and save."), `drop`, `run`, `working`, `pill`, `pillLabel`, `errors.forbidden`, `errors.badPhotos`, `errors.modelFailed`, `errors.decode`, `unrecognized`.

- [ ] **Step 1: Add the hook state and functions.** Unit-test anything non-trivial you add to the reducer in `src/lib/admin/editorSession.test.ts`, for example a `filled` reset on `openEdit`.
- [ ] **Step 2: Build the panel and the pills, and add the strings in both locales.**
- [ ] **Step 3: Verify**

Run: `bun run test && bunx tsc --noEmit && bun run lint`
Expected: PASS.

- [ ] **Step 4: Manual check in the dev preview** (`preview_start`, admin signed in, `/en/admin/products/new`):
  - a cap photo fills the fields with pills, price 120, and no typed field changes;
  - a tee photo switches to apparel, price 80, with colorways matched;
  - a non-product photo shows the note and fills nothing;
  - editing a filled field removes its pill;
  - Save creates the Product.
  Screenshot the filled form.
- [ ] **Step 5: Commit**

```bash
git add src/components/admin/products src/messages
git commit -m "feat(admin): Photo Autofill panel on the new product page"
```

---

### Task 7: Docs

- [ ] Set plan 0010's row in `docs/plans/README.md` to Implemented.
- [ ] Before the first deploy: confirm the Vercel project has AI Gateway access (OIDC) in Production and Preview. Optionally set a Gateway budget. Local dev needs a fresh `vercel env pull` for `VERCEL_OIDC_TOKEN`, which expires about every 12 h.
- [ ] Commit: `docs: mark plan 0010 implemented`.
