import { describe, expect, it } from "vitest";
import { parseTestAlertArgs, TEST_ALERT_USAGE } from "./testAlertArgs";

describe("parseTestAlertArgs", () => {
  it("defaults to the configured recipient on dev", () => {
    expect(parseTestAlertArgs([])).toEqual({ prod: false });
  });

  it("accepts an email and --prod", () => {
    expect(parseTestAlertArgs(["ops@example.com", "--prod"])).toEqual({ targetEmail: "ops@example.com", prod: true });
  });

  it("rejects unknown flags and extra arguments", () => {
    expect(() => parseTestAlertArgs(["--force"])).toThrow(TEST_ALERT_USAGE);
    expect(() => parseTestAlertArgs(["a@b.co", "c@d.co"])).toThrow(TEST_ALERT_USAGE);
    expect(() => parseTestAlertArgs(["not-an-email"])).toThrow(TEST_ALERT_USAGE);
  });
});
