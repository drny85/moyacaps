import { REJECT_REASON_MAX } from "../../../../convex/reviews/model";

export { REJECT_REASON_MAX };

export type ReviewStatus = "pending" | "published" | "rejected";
export type ReviewAction = "publish" | "reject" | "unpublish";

export const TABS: readonly ReviewStatus[] = ["pending", "published", "rejected"];

/** Each tab shows the reviews of the status with the same name. */
export function tabStatus(tab: ReviewStatus): ReviewStatus {
  return tab;
}

/** Publish is never offered on a review of a deleted account (the server refuses it). */
export function rowActions(row: { status: ReviewStatus; hiddenAt?: number }): ReviewAction[] {
  const canPublish = row.hiddenAt === undefined;
  switch (row.status) {
    case "pending":
      return canPublish ? ["publish", "reject"] : ["reject"];
    case "published":
      return ["unpublish"];
    case "rejected":
      return canPublish ? ["publish"] : [];
  }
}

/** The server clamps the count at 100, so 100 means "100 or more". Null hides the badge. */
export function pendingBadgeLabel(count: number | undefined): string | null {
  if (!count) return null;
  return count >= 100 ? "100+" : String(count);
}
