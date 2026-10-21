---
status: accepted
---

# Photo Autofill runs in a Next.js server action through the AI Gateway

Photo Autofill proposes a new Product's form values from photos (CONTEXT.md). It runs as a Next.js server action on Vercel that calls a vision model through the Vercel AI Gateway with the AI SDK, not as a Convex action, even though every other backend rule lives in `convex/` (ADR 0017). The call writes nothing: it returns a proposal that the Administrator reviews and saves through the normal `createVariant`, so it has no data to own and does not belong in the backend.

- **Auth.** The action checks the Clerk session and the Convex admin role before calling the model, the same gate as the admin pages (ADR 0004).
- **Gateway over OIDC.** On Vercel the AI Gateway authenticates with the project's OIDC token, so there is no provider key to store in Vercel or Convex. Locally, `vercel env pull` refreshes the token. The model defaults to `anthropic/claude-sonnet-5.5` and is overridden by `PRODUCT_AUTOFILL_MODEL`.
- **Photos stay out of storage.** Up to four photos are downscaled in the browser (about 1568 px long side, JPEG) to keep the request under Vercel's 4.5 MB body limit, and are dropped once the proposal returns. Catalog images still go through the image panel after create (ADR 0021).
- **One structured result, not a stream.** The empty-fields-only merge, the category's default price, Apparel Colorway matching and the slug suffix run once on the complete result in a pure, tested module.

## Considered options

- **Convex action**: matches ADR 0017, but needs an `AI_GATEWAY_API_KEY` in every Convex deployment and returns the proposal through a round trip that adds nothing, since no data is written.
- **Streaming partial objects**: fields appear sooner, but the merge would run on half-built values.

## Consequences

- Photo Autofill does not work where the Next.js app is not running on Vercel or lacks an OIDC token or `AI_GATEWAY_API_KEY`; the form still works by hand.
- Spend shows in the AI Gateway dashboard; a Gateway budget is the only hard ceiling.
- The AI Gateway free tier refuses every vision model tried (Sonnet 5.5, Haiku 5.5, Gemini 3 Flash): Photo Autofill needs paid Gateway credits on the Vercel team. Until then it answers with its "couldn't read the photos" error and the form works by hand.
