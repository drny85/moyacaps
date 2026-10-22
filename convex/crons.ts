import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";
import { BACKSTOP_INTERVAL_MINUTES } from "./orders/model";

const crons = cronJobs();

crons.interval(
  "product-image-orphan-cleanup",
  { hours: 24 },
  internal.catalog.images.cleanup.sweepOrphans,
  {}
);

// Checkout Hold backstop (ADR 0024): expire the session of any Order still awaiting payment
// 5 minutes after its hold ended, then release its hold once Stripe confirms the session expired.
crons.interval(
  "checkout-hold-backstop",
  { minutes: BACKSTOP_INTERVAL_MINUTES },
  internal.payments.checkout.sweepOverdueCheckoutHolds,
  {}
);

export default crons;
