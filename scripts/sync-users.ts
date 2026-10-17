/**
 * Backfill Clerk users into the Convex `users` table.
 *
 *   bun run sync-users          # dev deployment from .env.local
 *   bun run sync-users --prod   # production deployment
 *
 * Reads CLERK_SECRET_KEY locally (Bun loads .env.local) and writes through the
 * internal `users:upsertUsers` mutation via `convex run`, so no Clerk secret is
 * needed on the Convex deployment. Uses the same mapper as the Clerk webhook.
 */
import { toUserUpsert, type ClerkUserJSON } from "../convex/clerkUserModel";

const PAGE_SIZE = 100; // Clerk's max page size; matches users.MAX_USERS_PER_UPSERT.

const secretKey = process.env.CLERK_SECRET_KEY;
if (!secretKey) {
  console.error("CLERK_SECRET_KEY is missing in environment variables.");
  process.exit(1);
}

const convexRunFlags = process.argv.includes("--prod") ? ["--prod"] : [];

async function fetchClerkPage(offset: number): Promise<ClerkUserJSON[]> {
  const url = `https://api.clerk.com/v1/users?limit=${PAGE_SIZE}&offset=${offset}&order_by=created_at`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${secretKey}` } });
  if (!res.ok) {
    throw new Error(`Clerk API ${res.status}: ${await res.text()}`);
  }
  return (await res.json()) as ClerkUserJSON[];
}

function upsertBatch(users: ReturnType<typeof toUserUpsert>[]) {
  const proc = Bun.spawnSync(
    ["npx", "convex", "run", ...convexRunFlags, "users:upsertUsers", JSON.stringify({ users })],
    { stdout: "pipe", stderr: "pipe" }
  );
  if (proc.exitCode !== 0) {
    throw new Error(`convex run failed: ${proc.stderr.toString()}`);
  }
  return JSON.parse(proc.stdout.toString()) as { created: number; updated: number };
}

async function main() {
  console.log(`Syncing Clerk users to Convex (${convexRunFlags.length ? "prod" : "dev"})...`);

  let created = 0;
  let updated = 0;
  let missingEmail = 0;

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const page = await fetchClerkPage(offset);
    if (page.length === 0) break;

    const users = page.map(toUserUpsert);
    missingEmail += users.filter((u) => !u.email).length;

    const result = upsertBatch(users);
    created += result.created;
    updated += result.updated;
    console.log(`  page ${offset / PAGE_SIZE + 1}: ${result.created} created, ${result.updated} updated`);

    if (page.length < PAGE_SIZE) break;
  }

  console.log(`Done. Created ${created}, updated ${updated}, without email ${missingEmail}.`);
}

main().catch((err) => {
  console.error("User sync failed:", err);
  process.exit(1);
});
