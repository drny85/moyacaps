import { describe, expect, it } from "vitest";
import { autofillSteps } from "./progress";

describe("autofillSteps", () => {
  it("marks preparing active and the rest pending while photos shrink", () => {
    expect(autofillSteps("preparing")).toEqual([
      { key: "prepare", state: "active" },
      { key: "read", state: "pending" },
      { key: "fill", state: "pending" },
    ]);
  });

  it("marks preparing done and reading active while the model reads", () => {
    expect(autofillSteps("reading")).toEqual([
      { key: "prepare", state: "done" },
      { key: "read", state: "active" },
      { key: "fill", state: "pending" },
    ]);
  });
});
