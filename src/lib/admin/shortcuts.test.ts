import { describe, expect, it } from "vitest";
import { isTypingTarget, shortcutKey, shouldHandle } from "./shortcuts";

const key = (k: string, mods: Partial<{ metaKey: boolean; ctrlKey: boolean; altKey: boolean }> = {}) => ({
  key: k,
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  ...mods,
});

describe("shortcutKey", () => {
  it("names save with either modifier", () => {
    expect(shortcutKey(key("s", { metaKey: true }))).toBe("mod+s");
    expect(shortcutKey(key("S", { ctrlKey: true }))).toBe("mod+s");
  });

  it("names the plain keys", () => {
    expect(shortcutKey(key("Escape"))).toBe("escape");
    expect(shortcutKey(key("/"))).toBe("/");
    expect(shortcutKey(key("N"))).toBe("n");
    expect(shortcutKey(key("ArrowDown"))).toBe("ArrowDown");
    expect(shortcutKey(key("Enter"))).toBe("");
  });

  it("ignores other modifier combinations", () => {
    expect(shortcutKey(key("n", { metaKey: true }))).toBe("");
    expect(shortcutKey(key("s", { altKey: true }))).toBe("");
  });
});

describe("isTypingTarget", () => {
  it("counts form fields and editable content", () => {
    expect(isTypingTarget({ tagName: "INPUT" })).toBe(true);
    expect(isTypingTarget({ tagName: "TEXTAREA" })).toBe(true);
    expect(isTypingTarget({ tagName: "SELECT" })).toBe(true);
    expect(isTypingTarget({ tagName: "DIV", isContentEditable: true })).toBe(true);
    expect(isTypingTarget({ tagName: "A" })).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});

describe("shouldHandle", () => {
  it("lets only save and escape through while typing", () => {
    expect(shouldHandle("mod+s", true)).toBe(true);
    expect(shouldHandle("escape", true)).toBe(true);
    expect(shouldHandle("/", true)).toBe(false);
    expect(shouldHandle("n", true)).toBe(false);
    expect(shouldHandle("ArrowLeft", true)).toBe(false);
    expect(shouldHandle("n", false)).toBe(true);
    expect(shouldHandle("", false)).toBe(false);
  });
});
