"use server";

import { auth } from "@clerk/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "../../../convex/_generated/api";
import { runPhotoAutofill, type AutofillPhoto, type AutofillResponse } from "@/lib/server/photoAutofill";

const DEFAULT_MODEL = "anthropic/claude-sonnet-5.5";

/** Photo Autofill (ADR 0027). FormData: `photos` (downscaled JPEG blobs) and `locale` ("en" | "es"). */
export async function photoAutofill(formData: FormData): Promise<AutofillResponse> {
  const token = (await (await auth()).getToken({ template: "convex" })) ?? undefined;
  const photos: AutofillPhoto[] = await Promise.all(
    formData
      .getAll("photos")
      .filter((p): p is File => p instanceof Blob)
      .map(async (p) => ({ data: new Uint8Array(await p.arrayBuffer()), mediaType: p.type }))
  );
  const locale = formData.get("locale") === "es" ? "es" : "en";

  return runPhotoAutofill(
    {
      isAdmin: async () => token !== undefined && (await fetchQuery(api.users.functions.amIAdmin, {}, { token })),
      loadRows: async () => (await fetchQuery(api.catalog.admin.getAllProductsAdmin, { includeArchived: true }, { token })).variants,
      model: process.env.PRODUCT_AUTOFILL_MODEL || DEFAULT_MODEL,
    },
    photos,
    locale
  );
}
