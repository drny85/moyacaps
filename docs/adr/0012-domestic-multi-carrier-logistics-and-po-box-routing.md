# Domestic Multi-Carrier Logistics Strategy, PO Box Routing, and Crown Preservation

## Context
Good Luck 0880 retails handcrafted luxury streetwear caps ($65–$120+) featuring rigid crowns and high-density 3D embroidery. All shipments originate from the New York atelier studio (`10004`). The brand operates within a strictly defined **Fulfillment Territory**: domestic United States (50 US States), explicitly excluding Puerto Rico, unincorporated US territories, and international destinations.

Caps are packaged in rigid corrugated boxes (`8"×8"×6"`, `10"×8"×6"`, `12"×10"×8"`) weighing between 8 oz and 20 oz. Standardizing entirely on USPS Ground Advantage maximizes margin on single-cap orders ($5.50–$6.50) and provides free daily doorstep pickup by the regular postal carrier. However, multi-cap master cartons (3+ caps, exceeding 1 lb) lose their pricing advantage on USPS Priority Mail, and USPS canvas bulk sacks expose rigid cap boxes to crushing under heavier packages. Conversely, commercial couriers like UPS Ground offer rigid conveyor belt handling and guaranteed day-definite delivery, but enforce an $8+ commercial floor rate on sub-1lb packages and legally cannot deliver to Post Office Box addresses.

## Decision
1. **Hybrid Domestic Carrier Architecture (Primary USPS + High-Value UPS)**:
   - **Single & Double Cap Orders (≤ 16 oz)**: Default to **USPS Ground Advantage** for unbeatable sub-1lb commercial rates and zero-friction daily doorstep pickup.
   - **Collector Master Cartons (3+ caps / > 16 oz)**: Surface both **UPS Ground** and **USPS Priority Mail**, recommending UPS Ground for superior crown crush protection and day-definite tracking.
   - **Expedited Delivery Tier**: Fulfill via **UPS 2nd Day Air** with live Shippo discounted commercial rates for time-sensitive VIP drop releases.

2. **Automated P.O. Box Courier Guard**:
   - Automatically inspect shipping addresses (`line1`, `line2`) via regex for Post Office Box patterns (`/P\.?\s*O\.?\s*Box/i`).
   - If a PO Box destination is detected:
     - Disallow selection and purchase of commercial couriers (UPS, FedEx) that cannot deliver to PO Boxes.
     - Display a prominent admin notification banner in the Shipping Label Modal: *"P.O. Box Address: USPS Ground Advantage or Priority Mail is required. Commercial couriers (UPS) cannot deliver to P.O. Boxes."*
     - Default the label generator exclusively to compatible USPS postal services.

3. **Strict Fulfillment Territory Enforcement**:
   - Enforce server-side validation against Puerto Rico (`PR`, ZIP prefixes `006`, `007`, `009`), other US territories (`GU`, `VI`, `MP`, `AS`), and international destinations.
   - Prevent purchasing labels for destinations outside the 50 US States with informative customer and administrator error messaging.

4. **Curated Storefront Delivery Tiers**:
   - Shield the storefront from raw carrier calculators to preserve luxury brand aesthetics.
   - Offer clean, curated customer tiers (Standard Insured Delivery vs Priority Express) and empower administrators to execute carrier selection in the Admin Shipping Modal based on real-time rate, speed, and packaging volume.

## Consequences
- **Maximum Unit Economics**: Preserves maximum profit margins on 80%+ of routine single-cap domestic orders through sub-1lb USPS Ground Advantage.
- **Collector Investment Safeguard**: Eliminates crown-crushing damage and postal delay risks on high-ticket, multi-cap orders by leveraging UPS Ground and UPS 2nd Day Air.
- **Zero Failed Deliveries**: Programmatically eliminates undeliverable UPS shipments to PO Box addresses before labels are purchased.
