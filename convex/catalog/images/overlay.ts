/**
 * Pure read-model overlay (ADR 0021): the product's `productImages` rows, with their
 * URLs already resolved, replace the legacy string fields that have a row. A field with
 * no row keeps its legacy value, so products not yet migrated render unchanged.
 */
import type { Doc } from "../../_generated/dataModel";

export type ResolvedImageRow = {
  role: Doc<"productImages">["role"];
  colorway?: string;
  angle?: Doc<"productImages">["angle"];
  order: number;
  url: string;
};

export type CapAngles = { front: string; left: string; back: string; right: string };

type OverlayInput = {
  catalogShot?: string;
  images?: string[];
  colorways?: { id: string; lifestyleImage: string; catalogShot: string }[];
};

const ANGLES = ["front", "left", "back", "right"] as const;

/**
 * True for a legacy value that points at the site's own folders ("/shirts/…", "/catalog/…").
 * Product images left public/ for assets/source/ once every one had a row, so such a path
 * no longer serves; only absolute storage URLs do.
 */
export function isSitePath(src: string | undefined): boolean {
  return typeof src === "string" && src.startsWith("/");
}

type SitePathInput = OverlayInput & { image?: string; graphicImage?: string };

/** The variant with every legacy image field that is a site path blanked, before rows are laid over it. */
export function dropSitePaths<T extends SitePathInput>(variant: T): T {
  const keep = (src: string | undefined) => (isSitePath(src) ? undefined : src);
  const result: T = { ...variant };
  if (variant.image !== undefined) result.image = keep(variant.image) ?? "";
  if (variant.catalogShot !== undefined) result.catalogShot = keep(variant.catalogShot);
  if (variant.graphicImage !== undefined) result.graphicImage = keep(variant.graphicImage);
  if (variant.images) result.images = variant.images.filter((src) => !isSitePath(src));
  if (variant.colorways) {
    result.colorways = variant.colorways.map((c) => ({
      ...c,
      lifestyleImage: keep(c.lifestyleImage) ?? "",
      catalogShot: keep(c.catalogShot) ?? "",
    }));
  }
  return result;
}

/** Returns the variant with table images laid over its legacy fields; `angles` only when all four exist. */
export function overlayProductImages<T extends OverlayInput>(variant: T, rows: ResolvedImageRow[]): T & { angles?: CapAngles } {
  const sorted = [...rows].sort((a, b) => a.order - b.order);
  const urls = (role: ResolvedImageRow["role"], colorway: string | undefined) =>
    sorted.filter((r) => r.role === role && r.colorway === colorway).map((r) => r.url);

  const result: T & { angles?: CapAngles } = { ...variant };

  const catalogShot = urls("catalog", undefined)[0];
  if (catalogShot !== undefined) result.catalogShot = catalogShot;

  const lifestyle = urls("lifestyle", undefined);
  if (lifestyle.length > 0) result.images = lifestyle;

  if (variant.colorways) {
    result.colorways = variant.colorways.map((c) => {
      // Rows replace the legacy single photo; a colorway may have any number of Lifestyle Shots.
      // `lifestyleImages` is read-model only (resolvedVariant); `lifestyleImage` stays its first.
      const rowShots = urls("lifestyle", c.id);
      const lifestyleImages = rowShots.length > 0 ? rowShots : c.lifestyleImage ? [c.lifestyleImage] : [];
      return {
        ...c,
        catalogShot: urls("catalog", c.id)[0] ?? c.catalogShot,
        lifestyleImage: lifestyleImages[0] ?? c.lifestyleImage,
        lifestyleImages,
      };
    });
  }

  const angleUrls = ANGLES.map((angle) => sorted.find((r) => r.role === "angle" && r.angle === angle)?.url);
  if (angleUrls.every((u): u is string => u !== undefined)) {
    const [front, left, back, right] = angleUrls;
    result.angles = { front, left, back, right };
  }
  return result;
}

/**
 * Whether a row is the product's own Catalog Shot: one with no colorway, or the default
 * Apparel Colorway's. Only these back the grid card and `primaryImage`, so only these let a
 * product be shown (needs_image).
 */
export function isPrimaryCatalogRow(row: { role: ResolvedImageRow["role"]; colorway?: string }, defaultColorway: string | undefined): boolean {
  return row.role === "catalog" && (row.colorway === undefined || row.colorway === defaultColorway);
}

/**
 * The product's single `image` (cart, checkout, order snapshots), in order of precedence:
 * the legacy upload's URL, a non-blank stored `image` that is not a site path, the Catalog Shot row with no colorway,
 * then the default Apparel Colorway's Catalog Shot row. Blank when none exists.
 */
export function primaryImage(
  variant: { legacyUrl?: string; image: string; defaultColorway?: string },
  rows: ResolvedImageRow[]
): string {
  if (variant.legacyUrl) return variant.legacyUrl;
  if (variant.image.trim() !== "" && !isSitePath(variant.image)) return variant.image;
  const sorted = [...rows].sort((a, b) => a.order - b.order);
  const catalog = (colorway: string | undefined) => sorted.find((r) => r.role === "catalog" && r.colorway === colorway)?.url;
  return catalog(undefined) ?? (variant.defaultColorway ? catalog(variant.defaultColorway) : undefined) ?? "";
}
