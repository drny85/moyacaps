# convex/

Domain folders. Each folder holds thin Convex functions plus pure, tested model modules.
A function's API path follows its file: `convex/orders/desk.ts` → `api.orders.desk.*`.

| Folder           | Holds                                                                 |
| ---------------- | --------------------------------------------------------------------- |
| `lib/`           | Cross-domain helpers, no functions (`auth.ts` admin checks, `ids.ts`) |
| `users/`         | User mirror: functions, Clerk mapper (`clerk.ts`), Clerk webhook      |
| `catalog/`       | Products, variants, SKUs, inventory, drops, migrations                |
| `orders/`        | Order lifecycle: customer, admin desk, fulfillment, settlement, migrations |
| `payments/`      | Stripe: checkout, refunds, webhook, settlement and checkout models    |
| `shipping/`      | Shippo rates and labels                                               |
| `notifications/` | Resend emails and their React templates                               |
| `analytics/`     | Admin analytics                                                       |

Root keeps only what Convex requires there: `schema.ts`, `http.ts` (routes only),
`crons.ts`, `auth.config.ts`, `convex.config.ts`.

Conventions:
- Business logic goes in `*model.ts` / `model.ts` pure modules with a sibling `*.test.ts`.
- Integration tests use `convexTest(schema, import.meta.glob("/convex/**/*.ts"))`.
