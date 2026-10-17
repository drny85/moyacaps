import "server-only";
import { ConvexHttpClient } from "convex/browser";
import type { FunctionArgs, FunctionReference, FunctionReturnType } from "convex/server";

/**
 * Public Convex queries for statically rendered pages (ADR 0020).
 *
 * `convex/nextjs`'s `fetchQuery` sends every request with `cache: "no-store"`, which
 * makes the calling route dynamic. This client leaves the fetch cache option unset, so
 * the route prerenders and refreshes on its `revalidate` interval (ISR). Live stock and
 * price still arrive client-side through `useQuery`. Never use it for user-specific or
 * authenticated data: the result is shared by every visitor.
 */
export async function queryForStaticRender<Query extends FunctionReference<"query", "public">>(
  query: Query,
  args: FunctionArgs<Query>
): Promise<FunctionReturnType<Query>> {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) throw new Error("NEXT_PUBLIC_CONVEX_URL is not set");
  return new ConvexHttpClient(url).query(query, args);
}
