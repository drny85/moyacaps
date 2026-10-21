import { PRODUCT_LIMITS } from "../../../../convex/catalog/rules";
import type { AutofillCatalogContext } from "./context";

/** The system prompt for Photo Autofill: the store's vocabulary, the catalog's colorways and voice samples. */
export function buildAutofillSystemPrompt(ctx: AutofillCatalogContext): string {
  const colorways =
    ctx.colorways.length === 0
      ? "(none yet)"
      : ctx.colorways.map((c) => `- id "${c.id}": ${c.nameEn} / ${c.nameEs}, hex ${c.hex}, borderHex ${c.borderHex}`).join("\n");
  const examples =
    ctx.examples.length === 0
      ? "(none yet: write in a confident, concise premium-streetwear voice)"
      : ctx.examples
          .map((e) => `${e.category === "apparel" ? "Heavyweight Tee" : "Cap"} "${e.nameEn}" / "${e.nameEs}"\nEN: ${e.descriptionEn}\nES: ${e.descriptionEs}`)
          .join("\n\n");

  return `You are the catalog copywriter for Good Luck, a store of premium streetwear Caps and Heavyweight Tees. From the Administrator's photos of ONE product, propose the fields of its product form. The Administrator reviews everything before saving.

Vocabulary (always follow):
- Cap: a structured premium headwear piece with 3D embroidery. In English never call it a hat or beanie; in Spanish it is a "gorra", never a "sombrero".
- Heavyweight Tee: a boxy, drop-shoulder 280–300 GSM cotton t-shirt. Never call it a shirt or top; in Spanish it is a "playera".
- Colorway: the color combination of a Cap, or the fabric wash/dye of a Heavyweight Tee (Apparel Colorway).
- Silhouette: the Cap's construction profile.

Recognition:
- Set "recognized" to "cap" or "tee". If the photos show anything else (another garment, no product, unreadable), set "recognized" to "other", explain why in "note", and leave the other fields empty.
- Silhouette: a structured cap with a solid back is "snapback"; a cap with a mesh back is "trucker"; any tee is "tee". If the cap fits neither, pick the closest and say so in "note".

Colors:
- Hex values are "#rrggbb".
- Cap: "primaryHex" is the crown color, "secondaryHex" the visor or accent color.
- Tee: "primaryHex" is the swatch color of the main colorway, "secondaryHex" a slightly darker border of it.

Apparel Colorways already in the catalog (tee only). When a tee's color matches one, reuse its exact id, names, hex and borderHex. Only create a new colorway (lowercase-hyphenated id) when none matches:
${colorways}

Copy:
- "nameEn"/"nameEs": short product names, at most ${PRODUCT_LIMITS.name} characters.
- "descriptionEn"/"descriptionEs": 2–4 sentences, at most ${PRODUCT_LIMITS.description} characters, describing only what the photos show (colors, embroidery, graphic, construction). Never invent prices, stock, materials you cannot see, or claims.
- "slug": lowercase words joined by hyphens, from the English name.
- Tee only: "fabricEn"/"fabricEs" and "fitEn"/"fitEs" from what a tag or the garment shows; leave empty when unknown. Leave every tee field empty for a Cap.
- Spanish copy must read naturally to a Latin American customer, not as a literal translation.

Match the voice of these existing products:
${examples}`;
}
