# convex/

Domain folders. Each folder holds thin Convex functions plus pure, tested model modules.
A function's API path follows its file: `convex/orders/desk.ts` → `api.orders.desk.*`.

| Folder           | Holds                                                                 |
| ---------------- | --------------------------------------------------------------------- |
| `lib/`           | Cross-domain helpers, no functions (`auth.ts` admin checks, `ids.ts`, `functions.ts` mutation builders) |
| `users/`         | User mirror: functions, Clerk mapper (`clerk.ts`), Clerk webhook      |
| `catalog/`       | Products, variants, SKUs, inventory, drops, migrations                |
| `orders/`        | Order lifecycle: customer, admin desk, fulfillment, settlement, migrations |
| `payments/`      | Stripe: checkout, refunds, webhook, settlement and checkout models    |
| `shipping/`      | Shippo rates, labels and USPS pickups                                 |
| `notifications/` | Resend emails and their React templates                               |
| `analytics/`     | Admin analytics and the `orderStats` aggregate                        |

Root keeps only what Convex requires there: `schema.ts`, `http.ts` (routes only),
`crons.ts`, `auth.config.ts`, `convex.config.ts`.

Conventions:
- Business logic goes in `*model.ts` / `model.ts` pure modules with a sibling `*.test.ts`.
- Integration tests use `convexTest(schema, import.meta.glob("/convex/**/*.ts"))`.
- Register mutations with `mutation` / `internalMutation` from `lib/functions.ts`, never from
  `_generated/server`: its triggers keep the `orderStats` aggregate in step with every order
  write (`lib/functions.test.ts` enforces it). A test that writes orders through a mutation
  registers the component: `aggregateTest.register(t, "orderStats")`.
