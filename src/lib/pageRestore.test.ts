import { describe, expect, it, vi } from "vitest";
import { onPageRestore } from "./pageRestore";

function pageshow(persisted: boolean) {
  const event = new Event("pageshow");
  Object.defineProperty(event, "persisted", { value: persisted });
  return event;
}

describe("onPageRestore", () => {
  it("fires only when the page comes back from the back-forward cache", () => {
    const target = new EventTarget();
    const onRestore = vi.fn();
    onPageRestore(target, onRestore);

    target.dispatchEvent(pageshow(false));
    expect(onRestore).not.toHaveBeenCalled();

    target.dispatchEvent(pageshow(true));
    expect(onRestore).toHaveBeenCalledTimes(1);
  });

  it("stops listening after unsubscribe", () => {
    const target = new EventTarget();
    const onRestore = vi.fn();
    const unsubscribe = onPageRestore(target, onRestore);

    unsubscribe();
    target.dispatchEvent(pageshow(true));
    expect(onRestore).not.toHaveBeenCalled();
  });
});
