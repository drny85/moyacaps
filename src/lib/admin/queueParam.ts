/**
 * Stopgap until plan 0009 PR 2 gives the Orders desk real queues: Home links with
 * `?queue=` land on the closest filter the current desk has. Problems has none yet.
 */
const QUEUE_TO_DESK_FILTER: Record<string, string> = {
  needs_packing: "needs_packing",
  overdue: "overdue",
};

export function deskFilterForQueueParam(queue: string | null): string {
  return (queue && QUEUE_TO_DESK_FILTER[queue]) || "all";
}
