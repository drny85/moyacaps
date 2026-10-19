/** Admin keyboard shortcuts (D11): which key a keydown is, and whether to act on it. */

export type ShortcutKey = "mod+s" | "escape" | "/" | "n" | "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown" | "Home" | "End";

type KeyLike = { key: string; metaKey: boolean; ctrlKey: boolean; altKey: boolean };

const PLAIN: Record<string, ShortcutKey> = {
  Escape: "escape",
  "/": "/",
  n: "n",
  N: "n",
  ArrowLeft: "ArrowLeft",
  ArrowRight: "ArrowRight",
  ArrowUp: "ArrowUp",
  ArrowDown: "ArrowDown",
  Home: "Home",
  End: "End",
};

/** The shortcut a keydown names, or "" for none. ⌘ and Ctrl both count as "mod". */
export function shortcutKey(e: KeyLike): ShortcutKey | "" {
  if (e.altKey) return "";
  const mod = e.metaKey || e.ctrlKey;
  if (mod) return e.key.toLowerCase() === "s" ? "mod+s" : "";
  return PLAIN[e.key] ?? "";
}

export function isTypingTarget(el: { tagName?: string; isContentEditable?: boolean } | null): boolean {
  if (!el) return false;
  return el.isContentEditable === true || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName ?? "");
}

/** While typing in a field only save and escape act. */
export function shouldHandle(key: ShortcutKey | "", typing: boolean): boolean {
  if (key === "") return false;
  return !typing || key === "mod+s" || key === "escape";
}
