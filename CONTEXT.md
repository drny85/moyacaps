# MoyaCaps

An e-commerce platform for high-end streetwear caps (gorras) featuring signature collections, bilingual shopping (English/Spanish), interactive 3D/parallax showcase, and streamlined checkout.

## Language

**Cap**:
A structured, premium headwear piece featuring high-density 3D embroidery and adjustable closure.
_Avoid_: Hat, sombrero, beanie

**Colorway**:
A specific combination of crown, visor, underbill, and embroidery thread colors for a Cap model.
_Avoid_: Color theme, flavor

**Collection**:
A themed design release encompassing multiple colorways and silhouettes (e.g., the "Good Luck 0880" series).
_Avoid_: Category, department, bundle

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

**WhatsApp Concierge Order**:
An order initiated directly via WhatsApp chat for customers using manual payment or bank transfer, requiring manual administrator verification before fulfillment.
_Avoid_: Manual order, cash order, off-platform order

**User Account**:
A synchronized customer or administrator identity record mirrored into Convex from Clerk with role-based access control, profile metadata, and soft-delete retention for order audit history.
_Avoid_: Auth row, login entity

**Carrier Dispatch Deep Link**:
A direct external tracking URI generated for supported logistics couriers (DHL Express, FedEx, Estafeta, Correos de México, UPS) providing real-time package transit milestones for customers and staff.
_Avoid_: Tracking URL, tracking web link

**Public Tracking Portal**:
A secure, unauthenticated guest-accessible lookup interface requiring both Order Number and Checkout Email to inspect live fulfillment progress without account registration.
_Avoid_: Guest order checker, order finder, tracking form

**High-Friction Confirmation Safeguard**:
A mandatory interactive dialog requiring explicit user or administrator confirmation before executing irreversible, inventory-altering, or financially impactful operations (e.g. delivery completion, Stripe refund cancellations, stock deductions).
_Avoid_: Pop-up, alert box, notification


