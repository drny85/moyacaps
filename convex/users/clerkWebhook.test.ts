import { describe, expect, it } from "vitest";
import { Webhook } from "svix";
import { verifyClerkEvent } from "./clerkWebhook";

// svix test secret format: "whsec_" + base64 key. Not a real endpoint secret.
const SECRET = "whsec_" + btoa("clerk-webhook-test-secret-32bytes");

function signed(payload: string, secret = SECRET) {
  const id = "msg_test";
  const timestamp = new Date();
  return {
    "svix-id": id,
    "svix-timestamp": String(Math.floor(timestamp.getTime() / 1000)),
    "svix-signature": new Webhook(secret).sign(id, timestamp, payload),
  };
}

describe("verifyClerkEvent", () => {
  const payload = JSON.stringify({ type: "user.created", data: { id: "user_1" } });

  it("returns the parsed event for a valid signature", () => {
    expect(verifyClerkEvent(SECRET, payload, signed(payload))).toEqual({
      type: "user.created",
      data: { id: "user_1" },
    });
  });

  it("rejects a payload signed with another secret", () => {
    const other = "whsec_" + btoa("another-endpoint-secret-32bytes!!");
    expect(() => verifyClerkEvent(SECRET, payload, signed(payload, other))).toThrow();
  });

  it("rejects a tampered payload", () => {
    const headers = signed(payload);
    const tampered = payload.replace("user_1", "user_2");
    expect(() => verifyClerkEvent(SECRET, tampered, headers)).toThrow();
  });
});
