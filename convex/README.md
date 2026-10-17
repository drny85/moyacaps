# convex/

Domain folders. Each folder holds thin Convex functions plus pure, tested model modules.
A function's API path follows its file: `convex/orders/desk.ts` → `api.orders.desk.*`.

| Folder           | Holds                                                                 |
| ---------------- | --------------------------------------------------------------------- |
| `lib/`           | Cross-domain helpers, no functions (`auth.ts` admin checks, `ids.ts`) |
| `users/`         | User mirror: functions, Clerk mapper (`clerk.ts`), Clerk webhook      |
| `catalog/`       | Products, variants, SKUs, inventory, reservations, drops, migrations  |
| `orders/`        | Order lifecycle: customer, admin desk, fulfillment, settlement, WhatsApp |
| `payments/`      | Stripe: checkout, refunds, webhook, settlement and checkout models    |
| `shipping/`      | Shippo rates and labels                                               |
| `notifications/` | Resend emails and their React templates                               |
| `analytics/`     | Admin analytics                                                       |

Root keeps only what Convex requires there: `schema.ts`, `http.ts` (routes only),
`crons.ts`, `auth.config.ts`, `convex.config.ts`.

Conventions:
- Business logic goes in `*model.ts` / `model.ts` pure modules with a sibling `*.test.ts`.
- Integration tests use `convexTest(schema, import.meta.glob("/convex/**/*.ts"))`.

## Legacy path shims

`whatsappOrders.ts`, `emails.ts`, `drops.ts` and `stripeCheckout.ts` at the root only
re-export functions that may already be scheduled under their old paths. Delete them
after the refactor has been live in prod longer than the WhatsApp reservation hold.
