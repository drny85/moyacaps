/**
 * /llms.txt (llmstxt.org): a plain Markdown brief for AI assistants and agents. Only what a
 * shopper can actually reach today: products of Live categories, Try-On only while Caps are
 * Live (ADR 0022). Pure: covered by llms.test.ts.
 */
import type { ShippingSettings } from "../../../convex/settings/model";
import { catalogCategory } from "../../../convex/catalog/model";
import type { CapVariant } from "../../data/caps";
import { isTryOnAvailable, type CategoryLaunches } from "../launch";
import { SUPPORT_EMAIL } from "../legal";
import { isTee } from "../shop";
import { INSTAGRAM_URL, localizedUrl, SITE_NAME } from "./site";

export type LlmsInput = {
  products: CapVariant[];
  /** Category Status; undefined when Convex is unreachable, so no product is listed. */
  launches: CategoryLaunches | undefined;
  shipping: ShippingSettings | undefined;
  base: string;
};

const CATEGORY_LABEL = { headwear: "Caps", apparel: "Tees" } as const;

function productLine(p: CapVariant, base: string): string {
  const kind = isTee(p) ? "heavyweight tee" : "3D puff embroidery cap";
  return `- [${p.nameEn}](${localizedUrl("en", `/products/${p.id}`, base)}): $${p.priceUsd} USD, ${kind}`;
}

export function buildLlmsTxt({ products, launches, shipping, base }: LlmsInput): string {
  const url = (path: string) => localizedUrl("en", path, base);
  const live = launches
    ? products.filter((p) => p.isAvailable !== false && launches[catalogCategory(p)].status === "live")
    : [];
  const status = launches
    ? (Object.keys(CATEGORY_LABEL) as (keyof typeof CATEGORY_LABEL)[])
        .filter((c) => launches[c].status !== "hidden")
        .map((c) => `- ${CATEGORY_LABEL[c]}: ${launches[c].status === "live" ? "on sale now" : "coming soon"}`)
    : [];

  const lines = [
    `# ${SITE_NAME}`,
    "",
    `> ${SITE_NAME} (Good Luck 0880) is a New York streetwear brand that sells signature 0880 caps with high-density 3D puff embroidery and heavyweight graphic tees online. In Dominican street slang, 0880 means "nobody saw anything": an unwritten code of silence. It ships only within the United States. The site is in English (/en) and Spanish (/es).`,
    "",
    ...(status.length ? ["## Collections", "", ...status, ""] : []),
    ...(live.length ? ["## Products", "", ...live.map((p) => productLine(p, base)), ""] : []),
    "## Shop",
    "",
    `- [Shop all products](${url("/products")})`,
    `- [About Good Luck and what 0880 means](${url("/about")})`,
    ...(launches && isTryOnAvailable(launches) ? [`- [Virtual Try-On](${url("/try-on")}): try caps on with your camera, on-device`] : []),
    `- [Track an order](${url("/track")})`,
    "",
    "## Shipping",
    "",
    "- Ships to the 50 US states and Washington, DC only.",
    "- Standard shipping ships within 24 hours and usually arrives in 2–5 business days, with tracking.",
    ...(shipping
      ? [`- $${shipping.flatShippingFeeUsd.toFixed(2)} per order, free on ${shipping.freeShippingThresholdUnits} or more items.`]
      : []),
    "",
    "## Policies",
    "",
    `- [Terms & Conditions](${url("/terms")}): ordering, payment, shipping, cancellations`,
    `- [Return Policy](${url("/returns")}): all sales final; refund if a package never arrives, refund or exchange if an item arrives defective`,
    `- [Privacy Policy](${url("/privacy")})`,
    "",
    "## Contact",
    "",
    `- Email: ${SUPPORT_EMAIL}`,
    `- Instagram: ${INSTAGRAM_URL}`,
    "",
  ];
  return lines.join("\n");
}
