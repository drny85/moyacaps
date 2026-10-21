export type TestAlertRequest = { targetEmail?: string; prod: boolean };

export const TEST_ALERT_USAGE = "Usage: bun run send-test-admin-alert [email] [--prod]";

/** Parse `send-test-admin-alert` CLI args: an optional recipient, else the configured admin inbox. */
export function parseTestAlertArgs(argv: string[]): TestAlertRequest {
  const flags = new Set(argv.filter((a) => a.startsWith("--")));
  const positional = argv.filter((a) => !a.startsWith("--"));
  const unknown = [...flags].filter((f) => f !== "--prod");
  if (positional.length > 1 || unknown.length > 0) {
    throw new Error(TEST_ALERT_USAGE);
  }
  const email = positional[0]?.trim();
  if (email !== undefined && !email.includes("@")) {
    throw new Error(TEST_ALERT_USAGE);
  }
  return { ...(email && { targetEmail: email }), prod: flags.has("--prod") };
}
