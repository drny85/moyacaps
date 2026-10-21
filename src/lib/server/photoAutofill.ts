import "server-only";
import { generateText, Output, type LanguageModel } from "ai";
import { catalogContextFrom, type AutofillCatalogContext, type ContextRow } from "../admin/photoAutofill/context";
import { checkPhotos } from "../admin/photoAutofill/photos";
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

/** A downscaled photo is ~300 KB; anything far above it skipped the browser downscale. */
export const AUTOFILL_MAX_PHOTO_BYTES = 1.5 * 1024 * 1024;
const MODEL_TIMEOUT_MS = 60_000;

export async function runPhotoAutofill(deps: AutofillDeps, photos: AutofillPhoto[], locale: "en" | "es"): Promise<AutofillResponse> {
  if (!(await deps.isAdmin())) return { ok: false, error: "forbidden" };
  if (!checkPhotos(photos.map((p) => ({ type: p.mediaType }))).ok || photos.some((p) => p.data.byteLength > AUTOFILL_MAX_PHOTO_BYTES)) {
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
