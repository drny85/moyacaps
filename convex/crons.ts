import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "product-image-orphan-cleanup",
  { hours: 24 },
  internal.catalog.images.cleanup.sweepOrphans,
  {}
);

// Checkout Hold backstop (ADR 0024): expire the session of any Order still awaiting payment
// 45 minutes after Pay, then release its hold once Stripe confirms the session expired.
crons.interval(
  "checkout-hold-backstop",
  { hours: 1 },
  internal.payments.checkout.sweepOverdueCheckoutHolds,
  {}
);

export default crons;
