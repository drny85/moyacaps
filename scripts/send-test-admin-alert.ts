/**
 * Send a test admin order alert through Resend, to check email delivery.
 *
 *   bun run send-test-admin-alert                    # to ADMIN_NOTIFICATION_EMAIL, dev
 *   bun run send-test-admin-alert me@example.com --prod
 *
 * Runs the internal action notifications/emails:sendTestAdminOrderAlert (plan 0009 D8).
 */
import { parseTestAlertArgs } from "./lib/testAlertArgs";

let request;
try {
  request = parseTestAlertArgs(process.argv.slice(2));
} catch (err) {
  console.error((err as Error).message);
  process.exit(1);
}

const args = JSON.stringify(request.targetEmail ? { targetEmail: request.targetEmail } : {});
const proc = Bun.spawnSync(
  ["npx", "convex", "run", ...(request.prod ? ["--prod"] : []), "notifications/emails:sendTestAdminOrderAlert", args],
  { stdout: "pipe", stderr: "pipe" }
);
if (proc.exitCode !== 0) {
  console.error(proc.stderr.toString().trim());
  process.exit(1);
}
const result = JSON.parse(proc.stdout.toString());
console.log(`Test alert sent to ${result.recipient} on ${request.prod ? "prod" : "dev"}.`);
