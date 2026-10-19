/**
 * Pure: which files in `public/` become `productImages` rows (ADR 0021, migration script).
 * Variant data comes from `catalog/queries:getVariants`, which already resolves images that
 * have rows to absolute URLs, so only values starting with `/` are local files still to migrate.
 */
export type ImageRole = "catalog" | "lifestyle" | "angle";
export type CapAngle = "front" | "left" | "back" | "right";

export type ImageSource = { variantId: string; role: ImageRole; colorway?: string; angle?: CapAngle; publicPath: string };

export type CatalogShotsInput = {
  caps: Record<string, { catalog?: string; angles?: Partial<Record<CapAngle, string>> }>;
  tees: Record<string, { colorways: Record<string, string> }>;
};
export type CapsManifestInput = Record<string, { angles: Record<CapAngle, string> }>;
export type VariantInput = {
  variantId: string;
  image?: string;
  images?: string[];
  colorways?: { id: string; lifestyleImage?: string }[];
};

export const ANGLE_ORDER: readonly CapAngle[] = ["front", "left", "back", "right"];

const isLocal = (p: string | undefined): p is string => typeof p === "string" && p.startsWith("/");

export function collectImageSources(
  catalogShots: CatalogShotsInput,
  capsManifest: CapsManifestInput,
  variants: readonly VariantInput[],
): ImageSource[] {
  const out: ImageSource[] = [];
  const seen = new Set<string>();
  const add = (s: ImageSource) => {
    const key = [s.variantId, s.role, s.colorway, s.angle, s.publicPath].join("|");
    if (seen.has(key) || !isLocal(s.publicPath)) return;
    seen.add(key);
    out.push(s);
  };

  for (const variant of variants) {
    const id = variant.variantId;

    const cap = catalogShots.caps[id];
    if (cap) {
      if (cap.catalog) add({ variantId: id, role: "catalog", publicPath: cap.catalog });
    }
    if (cap || capsManifest[id]) {
      const hasShotAngles = cap?.angles !== undefined && ANGLE_ORDER.some((a) => cap.angles?.[a]);
      const angles = hasShotAngles ? cap?.angles : capsManifest[id]?.angles;
      for (const angle of ANGLE_ORDER) {
        const publicPath = angles?.[angle];
        if (publicPath) add({ variantId: id, role: "angle", angle, publicPath });
      }
    }

    const tee = catalogShots.tees[id];
    const colorwayIds = variant.colorways?.map((c) => c.id);
    if (tee) {
      for (const [colorway, publicPath] of Object.entries(tee.colorways)) {
        if (colorwayIds && !colorwayIds.includes(colorway)) continue;
        add({ variantId: id, role: "catalog", colorway, publicPath });
      }
    }
    for (const c of variant.colorways ?? []) {
      if (isLocal(c.lifestyleImage)) add({ variantId: id, role: "lifestyle", colorway: c.id, publicPath: c.lifestyleImage });
    }

    for (const publicPath of variant.images ?? []) {
      if (publicPath !== variant.image) add({ variantId: id, role: "lifestyle", publicPath });
    }
  }
  return out;
}
