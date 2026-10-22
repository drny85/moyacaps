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

**Drop**:
A scheduled moment at which a hidden Product becomes visible and sellable, with a countdown and a notify-me list beforehand. Set, postponed, released early or cancelled by an Administrator.
_Avoid_: Launch (that is Category Status), release, restock

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

**Photo Autofill**:
Proposing a new Product's form values from up to four photos for an Administrator to review: its category, Silhouette, colors (Apparel Colorways for a Heavyweight Tee), bilingual names and copy, and the category's default price. It fills only empty fields, never saves anything, and never sets stock, sizes, visibility or Featured. The photos are used for the proposal only and are not kept.
_Avoid_: AI form, magic fill, auto-create, smart fill

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
Where the store delivers: the 50 US States and the District of Columbia. Excluded: Puerto Rico, the US Virgin Islands, Guam and other territories, military addresses (APO/FPO/DPO, states AA/AE/AP) and every international destination. A paid Order outside it is flagged for refund at payment, not discovered at packing.
_Avoid_: Global shipping, domestic + territories, international orders, 50 states (when DC is meant too)

**Domestic Hybrid Fulfillment Matrix**:
How an Administrator picks the carrier for a label: USPS Ground Advantage for light single- and double-cap boxes (lowest cost, free pickup), UPS Ground for heavier master cartons. Customers see one Standard shipping option; the carrier choice is internal.
_Avoid_: Single-carrier setup, unmanaged multi-carrier, expedited tier

**PO Box Routing Safeguard**:
The automated address inspection mechanism detecting Post Office Box destinations and strictly restricting carrier rate selection to USPS, preventing invalid commercial courier (UPS/FedEx) label purchases.
_Avoid_: Manual address verification, unrestricted courier assignment

**Crown-Safe Packaging Presets**:
Calibrated rigid corrugated box specifications (`8"×8"×6"` single-cap, `10"×8"×6"` double-cap, `12"×10"×8"` collector master box) engineered with crown clearance to prevent visor bending or structured embroidery crushing during bulk transit.
_Avoid_: Bubble mailers, poly mailers, soft envelopes

**WhatsApp Support Chat**:
A link that opens a WhatsApp conversation with the store for questions. It never creates, reserves or settles an Order: every purchase goes through card checkout (ADR 0023).
_Avoid_: WhatsApp order, concierge order, Zelle payment

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
The units of a Cap, or of a Heavyweight Tee's SKU, that can still be sold: stock not already sold or held by a Checkout Hold. It bounds how many a Customer can add to the cart and buy.
_Avoid_: Quantity on hand, stock pool, supply

**Checkout In-Flight Lock**:
A concurrency mutex safeguarding customer checkout buttons and session generation against duplicate submissions, rapid double-clicks, and parallel gateway calls.
_Avoid_: Debounce guard, double-click blocker

**Order Settlement**:
The moment a Customer's payment succeeds and the Order's Checkout Hold becomes a sale: Payment Status turns paid and the held units leave Available Inventory for good.
_Avoid_: Order placement, payment commit, double transaction

**Checkout Session**:
The Stripe-hosted payment page for one Order, priced from the store's own data. It lasts 30 minutes; when it expires unpaid, the Order is cancelled and its Checkout Hold released.
_Avoid_: Payment link, cart checkout, gateway intent

**Checkout Hold**:
The units an awaiting-payment Order keeps out of Available Inventory while its Checkout Session is open, so two Customers can never pay for the same last unit. Ends in Order Settlement or, when the session expires, in release.
_Avoid_: Reservation, cart hold, soft lock

**Expired Checkout**:
An Order cancelled before any money arrived: its Checkout Session expired, was replaced or was left through Stripe's back link. It is an abandoned cart, not work: the admin desk lists it only under Cancelled, and the Customer never sees it.
_Avoid_: Awaiting payment (once cancelled), abandoned order, failed order

**Payment Status**:
Where an Order's money stands: awaiting payment, paid, partially refunded, refunded or disputed. Independent of Fulfillment Status.
_Avoid_: Order status (when meaning money only), paid flag

**Fulfillment Status**:
Where an Order's package stands: unfulfilled, ready to ship, in transit, delivered, delivery exception or returned. Only changes once the Order is paid. Independent of Payment Status. Moves past ready to ship only on a carrier scan (or an Administrator's correction), never on a Handoff.
_Avoid_: Shipping status, order status (when meaning the package only)

**Ready to Ship**:
The Fulfillment Status of an Order whose label is bought but which the carrier has not scanned yet. The box may still be on the Administrator's shelf or already handed over.
_Avoid_: Label purchased, shipped, on its way

**Handoff**:
The moment the Administrator gives a Ready to Ship package to the carrier: picked up (a scheduled pickup or the mail carrier at the door) or dropped off (post office, drop box, carrier store). Optional; the carrier's first scan makes it unnecessary. Each label has at most one, which can be corrected until the carrier's first scan. The Customer is told the package has shipped at the Handoff or the first scan, whichever comes first.
_Avoid_: Shipped, dispatched, pickup (when meaning the act, not the scheduled visit)

**Order Timeline**:
The dated history of an Order: payment, refunds, labels, Handoff and every carrier scan. The Customer sees only the package milestones.
_Avoid_: Activity log, audit trail, tracking history (when meaning the whole Order)

**Needs Packing**:
A paid Order with no shipping label yet. The Administrator's queue.
_Avoid_: Pending, open, unfulfilled (when meaning the queue), needs attention (that is a Product concept)

**Packing Checklist**:
The on-screen list of every unit a Needs Packing Order still has to ship, ticked off one unit at a time as the Administrator puts it in the box. Every Order has one, even a single Cap. Units already refunded or cancelled are not on it. It is kept on the Order, so a half-ticked list survives a reload or a change of device. Buying a label with units not yet Checked asks for confirmation; it is never blocked. Once a label is bought the list is frozen as a record; a Reship starts a fresh, unticked one. If a unit is refunded after it was Checked, the Administrator is told to take it back out of the box.
_Avoid_: Pick list, verification, packed (when meaning a ticked unit)

**Checked**:
A unit on the Packing Checklist that the Administrator has matched to its Product, Colorway and size and put in the box.
_Avoid_: Packed, verified, picked

**Tracking Number**:
The carrier's number for an Order's package. It exists only once a shipping label is bought; an Order with no label has none.
_Avoid_: Order number, internal tracking code

**Restock**:
Returning a refunded or returned line's units to Available Inventory. Always an explicit Administrator choice per line, never automatic; an unsellable return is never restocked.
_Avoid_: Inventory release (that is for an expired Checkout Hold), auto-restock

**Final Sale**:
The store's Return Policy: every sale is final, so nothing is taken back for a change of mind, fit, size or color. A paid Order can still be cancelled before it ships (Customer Cancellation). A package that never arrives is refunded in full once tracking confirms it was not delivered, and a defective item can be sent back as a Return.
_Avoid_: No refunds, returns window, 30-day returns

**Return**:
A Customer sending back a defective item, the only kind of Return under Final Sale. Requested by email to support; the Administrator replies with a return address and, once the item arrives, refunds it or exchanges it for the same item (a refund when that item is sold out). Refunds are by line, and Restock is decided per line; a defective item is never restocked.
_Avoid_: Exchange (an exchange is a Return plus a new Order), change-of-mind return

**Customer Cancellation**:
A signed-in Customer cancelling their own paid Order for a full automatic refund, allowed only while it is unfulfilled. Guests cancel through support.
_Avoid_: Void, abort, order deletion

**Delivery Exception**:
The carrier could not deliver the package (failed attempt, damage, address problem). The Administrator and Customer are told; the Administrator then reships or refunds.
_Avoid_: Lost package, shipping error

**Reship**:
Buying a new label for the same Order after a Delivery Exception or a return to sender. The Order keeps the history of every label.
_Avoid_: Replacement order, duplicate order

**Goodwill Refund**:
A free-amount refund an Administrator gives outside any line (an apology, a delay). It never Restocks.
_Avoid_: Credit, partial refund (when meaning a line refund)

**Product Review**:
A Verified Buyer's 1–5 star rating of a Product, with an optional title and text. It covers the whole Product across its Colorways and sizes, and notes what the Customer bought (e.g. "Bought: Black / L"). One per Customer per Product; the Customer may edit it. Shown on both locales in the language it was written, never translated.
_Avoid_: Testimonial, feedback, comment, rating (when meaning the whole review)

**Verified Buyer**:
A signed-in Customer who owns a delivered Order containing the Product, on a line that was neither refunded nor cancelled. A guest Order counts once claimed by the Customer's verified email. Only a Verified Buyer can write a Product Review.
_Avoid_: Reviewer, verified purchase (when meaning the person)

**Review Status**:
Where a Product Review stands: **Pending** (waiting for an Administrator), **Published** (shown on the storefront) or **Rejected** (never shown). Every new or edited review starts Pending; nothing is public until an Administrator publishes it. An Administrator may reject with a reason the Customer sees, or unpublish a Published review back to Rejected. A review stays Published if its line is later refunded.
_Avoid_: Approved flag, hidden, moderation state

**Review Invite**:
One email per delivered Order, sent 7 days after delivery, asking the Customer to review the Products they can review. Never repeated as a reminder; respects the Customer's email unsubscribe.
_Avoid_: Review reminder, feedback request

**Account Invite**:
The offer a guest gets after paying to create an account, or sign in, with the email they checked out with, so their guest Order joins that account. Shown on the order confirmation page and in the order confirmation email. Never shown before payment and never a condition of checkout: a guest pays without deciding anything about an account. It promises only what an account gives: every Order in one place, Customer Cancellation and writing Product Reviews.
_Avoid_: Sign-up gate, account wall, registration prompt, guest choice screen

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


