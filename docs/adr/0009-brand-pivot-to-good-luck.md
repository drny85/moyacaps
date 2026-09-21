# Brand Pivot from Moya Caps to Good Luck

## Context
The e-commerce platform was originally launched under the brand name "Moya Caps" (with the flagship collection named "Good Luck 0880"). To streamline the brand architecture and elevate the label's identity, the master brand is pivoting from "Moya Caps" to **"Good Luck"**. 

This transition involves user-facing marketing touchpoints, navigation headers, email receipts, customer service WhatsApp concierge channels, and public fulfillment tracking. However, an uncoordinated search-and-replace could trigger breaking regressions across CSS variables, Tailwind utility classes, Convex data models, and customer `localStorage` cart sessions.

## Decision
1. **Master Brandmark & Presentation**:
   - The master brand name is formally **"Good Luck"** (rendered as **GOOD LUCK** in navigation branding, packing slip letterheads, and receipt headers).
   - Individual products are referred to in copy as **"Good Luck cap"** or **"Good Luck caps"**.
   - The flagship release line is designated as the **"0880 Series"** or **"0880 Signature Edition"**, eliminating redundant phrasing (e.g. avoiding "Good Luck Good Luck").
2. **Customer & Administrative Communication Surface**:
   - 100% of user-facing copy in English (`en.json`) and Spanish (`es.json`), SEO metadata, OpenGraph site names (`siteName: "Good Luck"`), Twitter cards, receipt emails (`CustomerReceipt.tsx`), and automated dispatch alerts (`AdminOrderAlert.tsx`) are transitioned to Good Luck.
   - WhatsApp concierge greetings are aligned to address the brand as "Good Luck".
3. **Internal Styling and State Continuity**:
   - Existing Tailwind color tokens and CSS variables (e.g. `var(--moya-red)`, `bg-moya-red`, `text-moya-green`) and client-side storage keys (`moyacaps-storage`) are preserved as internal implementation aliases.
   - This prevents CSS class mismatches, preserves active customer shopping carts across deployments, and avoids unnecessary refactoring friction in purely styling-layer code.
