import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "product-image-orphan-cleanup",
  { hours: 24 },
  internal.catalog.images.cleanup.sweepOrphans,
  {}
);

export default crons;
