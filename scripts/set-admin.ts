/**
 * Grant or revoke Administrator on a Convex users row (convex/lib/auth.ts reads it).
 *
 *   bun run set-admin staff@example.com            # grant, dev
 *   bun run set-admin user_xxx --revoke --prod     # revoke, production
 *
 * The user must have signed in once so their row exists. Clerk publicMetadata is
 * not used: it is client-writable and never confers admin.
 */
import { parseSetAdminArgs } from "./lib/setAdminArgs";

let request;
try {
  request = parseSetAdminArgs(process.argv.slice(2));
} catch (err) {
  console.error((err as Error).message);
  process.exit(1);
}

const args = JSON.stringify({ ...request.target, role: request.role });
const proc = Bun.spawnSync(
  ["npx", "convex", "run", ...(request.prod ? ["--prod"] : []), "users/functions:setUserRole", args],
  { stdout: "pipe", stderr: "pipe" }
);
if (proc.exitCode !== 0) {
  console.error(proc.stderr.toString().trim());
  process.exit(1);
}
const result = JSON.parse(proc.stdout.toString());
console.log(`${result.email || result.clerkId} is now ${result.role} on ${request.prod ? "prod" : "dev"}.`);
