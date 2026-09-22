# ADR 0010: WhatsApp Concierge Order Pipeline & Admin Payment Link Dispatch

## Context
Good Luck operates exclusively within the domestic United States for its luxury streetwear cap collections. While direct on-site card checkout with Stripe is supported, a significant segment of luxury streetwear collectors prefers personalized interaction, manual order confirmation, Apple Pay via link, or offline Zelle bank transfers via WhatsApp.

Prior to this decision:
1. Legacy order prefixes used `MC-`, inconsistent with the master brand Good Luck (`GL-`).
2. Order submissions were vulnerable to incomplete addresses, unverified ZIP codes, and lack of pre-submission customer review.
3. Automatically embedding payment links in customer initial messages bypassed administrative order and delivery review, leaving orders in ambiguous payment states.

## Decision

1. **Brand Order Prefix & US Shipping Boundary**:
   - All new orders use the `GL-` prefix (e.g. `GL-WA-XXXXXX` for WhatsApp concierge orders and `GL-TRK-XXXXXX` for fulfillment tracking).
   - Address collection enforces strict domestic US validation: Title-cased street line 1, uppercase `APT / Suite` line 2, title-cased city, 50 US states dropdown, and numeric 5-digit postal code.
   - Backwards-compatibility is preserved for legacy `MC-` order tracking lookups.

2. **2-Step Review & Confirm Customer Wizard**:
   - The Cart Drawer employs a 2-step wizard:
     - **Step 1 (Form)**: Validates US shipping and contact information.
     - **Step 2 (Review & Confirm)**: Presents formatted delivery card, itemized summary with Free Express Shipping indicator, and clear notice that the store concierge will review their order and send a secure payment link.
   - The customer's initial outgoing WhatsApp message contains only the order greeting, itemized breakdown, and verified shipping destination—it **does not** include a payment link.

3. **Administrator Review & Payment Link Dispatch**:
   - When a WhatsApp concierge order is submitted, Convex creates the order record (`whatsapp_initiated`), reserves variant stock immediately, and pre-generates a 24-hour Stripe checkout session (`paymentUrl`).
   - In the Admin Panel (`/admin/orders` and `/admin/orders/[orderNumber]`), administrators inspect the order and click **`[ Send Payment Link on WhatsApp ]`**.
   - Dispatching the link records `paymentLinkSentAt: Date.now()`, extends the 24-hour stock reservation hold from the dispatch timestamp, and opens a pre-formatted WhatsApp chat to the customer's phone containing the checkout link and Zelle details.

4. **Settlement & Stock Hold Safety**:
   - Orders remain in `whatsapp_initiated` (marked with *Needs Payment Link* or *Link Sent* badges) until payment is finalized.
   - **Stripe Webhook Settlement**: When the customer pays via the Stripe link, the webhook matches the existing order by `orderNumber`, sets status to `paid`, and skips redundant stock deductions.
   - **Zelle / Transfer Settlement**: Administrators can confirm offline payments with a 1-click **`[ Mark as Paid (Zelle) ]`** action (`markWhatsAppOrderPaidAdmin`), which marks the order paid, assigns tracking, logs staff audit notes, and queues the customer email receipt.
   - If unpaid after 24 hours from link dispatch, automated Convex crons release the reservation and restore inventory.
