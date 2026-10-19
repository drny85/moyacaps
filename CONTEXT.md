# Good Luck

An e-commerce platform for high-end streetwear caps (gorras) and heavyweight apparel tees featuring signature collections, bilingual shopping (English/Spanish), interactive 3D/parallax showcase, model lookbook studio, and streamlined checkout.

## Language

**Cap**:
A structured, premium headwear piece featuring high-density 3D embroidery and adjustable closure.
_Avoid_: Hat, sombrero, beanie

**Heavyweight Tee**:
A boxy, drop-shoulder luxury streetwear t-shirt crafted in 280–300 GSM combed cotton with high-density screen print graphics (front chest or back print) and signature Good Luck branding.
_Avoid_: Shirt, regular t-shirt, top, undershirt

**Colorway**:
A specific combination of crown, visor, underbill, and embroidery thread colors for a Cap model.
_Avoid_: Color theme, flavor

**Apparel Colorway**:
The specific textile fabric wash/dye of a Heavyweight Tee (Vintage Washed Black, Crisp White, Heather Grey, Butter Cream, Acid Wash Lime). Most Graphic Designs come in the first four; a photographed printed tee such as the Crash Scene Tee may come in only its own colorway.
_Avoid_: Shirt color, shade

**Graphic Design**:
The authentic artwork motif printed on a Heavyweight Tee (e.g., "Boxing Gloves", "Gothic Skull", "Street 8-Ball", "Eagle & Clover").
_Avoid_: Logo, print, picture

**Model Lookbook Studio**:
An interactive shopping interface enabling customers to preview any Graphic Design across different Apparel Colorways on realistic streetwear model photography before selecting a size and adding to cart.
_Avoid_: Mockup tool, customizer, shirt maker

**Try-On**:
Previewing a Cap on a photo of the Customer's own head (a selfie or a camera snapshot), placed automatically on the face and fine-tuned by hand, before adding it to the bag. Caps only; a Heavyweight Tee is never tried on.
_Avoid_: Virtual mirror, AR, fitting room, try-on studio

**Try-On Photo**:
The Customer's photo used for a Try-On. It stays on the device and in memory only: it is never uploaded or saved, and is gone when the page closes.
_Avoid_: Selfie (when meaning the stored image), avatar, portrait

**Collection**:
A themed design release encompassing multiple colorways and silhouettes (e.g., the "0880 Series" for Headwear and "0880 Heavyweight Apparel").
_Avoid_: Category, department, bundle

**Product**:
Any sellable item in the storefront, either a Cap or a Heavyweight Tee, browsed, filtered and displayed through one shared card and one product page. A Product starts hidden; Customers see it only once an Administrator makes it visible and its category's Category Status is Live.
_Avoid_: Item, cap (when meaning tees too), listing

**Category Status**:
Whether a category (Caps or Tees) is **Live** (its visible Products are shown and sellable), **Coming Soon** (a Coming Soon Teaser shows instead of Products) or **Hidden** (the category is gone from the storefront). Set by an Administrator, optionally with a launch date that turns it Live automatically (ADR 0022).
_Avoid_: Category toggle, category flag, store mode

**Coming Soon Teaser**:
What a Coming Soon category shows in place of its Products: a headline, an optional countdown to its launch date, and a sign-up to be notified when it goes Live.
_Avoid_: Splash page, placeholder, waitlist page

**Catalog Shot**:
The canonical 4:5 product image and the only image role allowed in grids and cards: a Cap alone on the shared studio backdrop, or (until flat-lay photos exist) a Heavyweight Tee cropped from its on-model photo.
_Avoid_: Thumbnail, packshot, mockup, product photo

**Lifestyle Shot**:
An image of a Product worn by a model or placed in a scene. Shown on product pages and in editorial sections, never as the grid image.
_Avoid_: Model photo, lookbook image, hero shot

**Angle Shot**:
A transparent cutout of a Cap from one of four fixed angles (front, left, back, right), used by Try-On and the turntable. A Cap missing any Angle Shot is left out of both. Never shown in grids or cards, and never taken of a Heavyweight Tee.
_Avoid_: Angle image, cutout, 360 shot, turntable frame

**Shop**:
The single browsable listing of every Product, filterable by category, Colorway, Silhouette and Graphic Design.
_Avoid_: Catalog page, store page, collection page (Collection means a themed release)

**SKU**:
One purchasable combination of a Heavyweight Tee: Graphic Design × Apparel Colorway × size, holding its own Available Inventory.
_Avoid_: Option, sub-variant, size row

**Silhouette**:
The structural profile and construction of the Cap (e.g., Classic 6-Panel Snapback vs 5-Panel Trucker Mesh).
_Avoid_: Shape, cut, form factor

**Customer**:
A visitor browsing the catalog, adding items to their cart, or placing an order.
_Avoid_: User, client, buyer

**Administrator**:
An authenticated staff member with elevated permissions to govern catalog items, execute order fulfillments, and review store operational metrics.
_Avoid_: Superuser, mod, backend user, manager

**Fulfillment**:
The operational lifecycle of packing, carrier assigning, dispatching, and recording delivery status for customer orders.
_Avoid_: Shipping process, handling

**Fulfillment Territory**:
The geographical boundary supported for customer order delivery: strictly domestic United States (50 US States), explicitly excluding Puerto Rico (PR), US Virgin Islands, Guam, other unincorporated territories, and international destinations.
_Avoid_: Global shipping, domestic + territories, international orders

**Domestic Hybrid Fulfillment Matrix**:
The tiered carrier dispatch policy deploying USPS Ground Advantage for standard sub-1lb single/double cap shipments (free doorstep pickup, lowest commercial cost) and commercial couriers (UPS Ground, UPS 2nd Day Air) for multi-cap master cartons and expedited VIP drops.
_Avoid_: Single-carrier setup, unmanaged multi-carrier

**PO Box Routing Safeguard**:
The automated address inspection mechanism detecting Post Office Box destinations and strictly restricting carrier rate selection to USPS, preventing invalid commercial courier (UPS/FedEx) label purchases.
_Avoid_: Manual address verification, unrestricted courier assignment

**Crown-Safe Packaging Presets**:
Calibrated rigid corrugated box specifications (`8"×8"×6"` single-cap, `10"×8"×6"` double-cap, `12"×10"×8"` collector master box) engineered with crown clearance to prevent visor bending or structured embroidery crushing during bulk transit.
_Avoid_: Bubble mailers, poly mailers, soft envelopes

**WhatsApp Concierge Order**:
An order initiated via the Loot Bag for domestic US delivery, reserving inventory for 24 hours in Convex. The customer provides their name and email for tracking and receipt dispatch; physical US shipping address entry, phone collection, and real-time state sales taxes are delegated to the official Stripe checkout payment link (or entered manually by an Administrator for offline Zelle settlements). The order begins in review (`whatsapp_initiated`) and is not marked as paid until the customer completes checkout via the payment link or verified bank transfer.
_Avoid_: Manual order, cash order, off-platform order, instant WhatsApp checkout

**Concierge Payment Link Dispatch**:
The operational action performed by an Administrator after inspecting a WhatsApp Concierge Order, stamping `paymentLinkSentAt`, extending the 24-hour inventory reservation hold, and delivering the pre-generated Stripe checkout link or Zelle details back to the Customer via WhatsApp chat.
_Avoid_: Link sharing, manual text, invoice sending

**WhatsApp Order Settlement**:
The atomic transition of a WhatsApp Concierge Order from `whatsapp_initiated` to `paid`, triggered either automatically when the Customer completes the Stripe checkout link (where Stripe captures the shipping address, phone, and sales tax, and reconciles by `orderNumber` in the webhook) or manually by an Administrator confirming a verified Zelle / bank transfer receipt (`markWhatsAppOrderPaidAdmin`).
_Avoid_: Offline mark, manual pay, cash reconcile

**User Account**:
A synchronized customer or administrator identity record mirrored into Convex from Clerk with role-based access control, profile metadata, and soft-delete retention for order audit history.
_Avoid_: Auth row, login entity

**Carrier Dispatch Deep Link**:
A direct external tracking URI generated for supported logistics couriers (USPS, UPS) providing real-time package transit milestones for customers and staff.
_Avoid_: Tracking URL, tracking web link

**Public Tracking Portal**:
A secure, unauthenticated guest-accessible lookup interface requiring both Order Number and Checkout Email to inspect live fulfillment progress without account registration.
_Avoid_: Guest order checker, order finder, tracking form

**High-Friction Confirmation Safeguard**:
A mandatory interactive dialog requiring explicit user or administrator confirmation before executing irreversible, inventory-altering, or financially impactful operations (e.g. delivery completion, Stripe refund cancellations, stock deductions).
_Avoid_: Pop-up, alert box, notification

**Available Inventory**:
The current real-time stock units of a specific Cap Variant ready for sale in Convex, strictly bounding customer cart additions and gateway session generation.
_Avoid_: Quantity on hand, stock pool, supply

**Checkout In-Flight Lock**:
A concurrency mutex safeguarding customer checkout buttons and session generation against duplicate submissions, rapid double-clicks, and parallel gateway calls.
_Avoid_: Debounce guard, double-click blocker

**Order Settlement**:
The irreversible atomic transaction finalizing a customer purchase, deducting confirmed units from Available Inventory and issuing a persistent order number.
_Avoid_: Order placement, payment commit, double transaction

**Checkout Session**:
An ephemeral payment gateway session created with Stripe hosting pre-validated items and prices, bounded by a strict idempotency key.
_Avoid_: Payment link, cart checkout, gateway intent

**Cap Media Storage**:
Convex binary storage (`_storage`) managing high-resolution product photography for Cap Variants, referenced by immutable `storageId` and resolved to signed CDN URLs during catalog queries.
_Avoid_: Asset bucket, static image directory, media folder

## Production Environment & Domain Configuration

- **Production Web URL / Canonical Domain**: `https://goodluckcaps.com`
- **Environment Variables**:
  - `NEXT_PUBLIC_SITE_URL=https://goodluckcaps.com` (Frontend metadataBase, sitemap, robots, OpenGraph, JSON-LD)
  - `NEXT_PUBLIC_APP_URL=https://goodluckcaps.com` (Convex emails, tracking links, admin alerts)
- **Support & Transactional Email Host**: `goodluckcaps.com` (`orders@goodluckcaps.com`, `support@goodluckcaps.com`)
- **Key Routing Endpoints**:
  - Storefront: `https://goodluckcaps.com`
  - Public Tracking Portal: `https://goodluckcaps.com/track`
  - Admin Operations Suite: `https://goodluckcaps.com/admin/orders`


