import { defineApp } from "convex/server";
import resend from "@convex-dev/resend/convex.config";
import rateLimiter from "@convex-dev/rate-limiter/convex.config";
import aggregate from "@convex-dev/aggregate/convex.config";

const app = defineApp();
app.use(resend);
app.use(rateLimiter);
// Order counts and revenue by status for the admin dashboard (analytics/orderStats.ts).
app.use(aggregate, { name: "orderStats" });
// Active drop-alert sign-ups per product for the Drop Radar (catalog/dropAlertStats.ts).
app.use(aggregate, { name: "dropAlertStats" });

export default app;
