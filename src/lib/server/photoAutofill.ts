import "server-only";
import { generateText, Output, type LanguageModel } from "ai";
import { catalogContextFrom, type AutofillCatalogContext, type ContextRow } from "../admin/photoAutofill/context";
import { AUTOFILL_MAX_UPLOAD_BYTES, checkPhotos } from "../admin/photoAutofill/photos";
import { buildAutofillSystemPrompt } from "../admin/photoAutofill/prompt";
import { autofillProposalSchema, type AutofillProposal } from "../admin/photoAutofill/schema";

/** Photo Autofill's server side (ADR 0027): admin gate, one model call, a typed proposal. Writes nothing. */

export type AutofillDeps = {
  isAdmin: () => Promise<boolean>;
  loadRows: () => Promise<ContextRow[]>;
  model: LanguageModel;
};

export type AutofillResponse =
  | { ok: true; proposal: AutofillProposal; context: AutofillCatalogContext }
  | { ok: false; error: "forbidden" | "bad_photos" | "model_failed" };

export type AutofillPhoto = { data: Uint8Array; mediaType: string };

const MODEL_TIMEOUT_MS = 60_000;

/** `photos` may be lazy so an unauthorized caller's upload is never read into memory. */
export async function runPhotoAutofill(
  deps: AutofillDeps,
  photosOrLoad: AutofillPhoto[] | (() => Promise<AutofillPhoto[]>),
  locale: "en" | "es"
): Promise<AutofillResponse> {
  if (!(await deps.isAdmin())) return { ok: false, error: "forbidden" };
  const photos = typeof photosOrLoad === "function" ? await photosOrLoad() : photosOrLoad;
  if (!checkPhotos(photos.map((p) => ({ type: p.mediaType }))).ok || photos.some((p) => p.data.byteLength > AUTOFILL_MAX_UPLOAD_BYTES)) {
    return { ok: false, error: "bad_photos" };
  }

  try {
    const context = catalogContextFrom(await deps.loadRows());
    const { output } = await generateText({
      model: deps.model,
      system: buildAutofillSystemPrompt(context, locale),
      output: Output.object({ schema: autofillProposalSchema }),
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Propose the product fields for these photos." },
            ...photos.map((p) => ({ type: "file" as const, mediaType: p.mediaType, data: p.data })),
          ],
        },
      ],
      maxRetries: 1,
      abortSignal: AbortSignal.timeout(MODEL_TIMEOUT_MS),
    });
    return { ok: true, proposal: output, context };
  } catch (error) {
    console.error("photoAutofill: model call failed", error instanceof Error ? error.message : error);
    return { ok: false, error: "model_failed" };
  }
}
