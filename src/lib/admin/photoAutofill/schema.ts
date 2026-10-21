import { z } from "zod";

/**
 * What the vision model returns for Photo Autofill (CONTEXT.md, ADR 0027). Every field is
 * required so the provider's structured output stays strict: tee-only fields come back
 * empty for a Cap. The category is derived from `recognized`, never asked for separately.
 */
export const autofillProposalSchema = z.object({
  recognized: z.enum(["cap", "tee", "other"]).describe("cap or tee when the photos show one; other for anything else"),
  note: z.string().describe("One short sentence for the Administrator; empty when there is nothing to flag"),
  silhouette: z.enum(["snapback", "trucker", "tee"]),
  primaryHex: z.string().describe("#rrggbb. Cap: the crown color. Tee: the card swatch color"),
  secondaryHex: z.string().describe("#rrggbb. Cap: the visor or accent color. Tee: the swatch border"),
  nameEn: z.string(),
  nameEs: z.string(),
  slug: z.string().describe("lowercase-hyphenated URL slug"),
  descriptionEn: z.string(),
  descriptionEs: z.string(),
  colorways: z
    .array(z.object({ id: z.string(), nameEn: z.string(), nameEs: z.string(), hex: z.string(), borderHex: z.string() }))
    .describe("Tee only: one per Apparel Colorway seen; empty for a Cap"),
  fabricEn: z.string(),
  fabricEs: z.string(),
  fitEn: z.string(),
  fitEs: z.string(),
});

export type AutofillProposal = z.infer<typeof autofillProposalSchema>;
