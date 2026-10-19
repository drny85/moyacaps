/**
 * Keyboard shortcut that opens search (plan 0006): "/" anywhere the Customer is not typing,
 * and Cmd+K / Ctrl+K everywhere. Pure, so the rule is testable without a DOM.
 */
export interface ShortcutKeyEvent {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  /** Focus is in an input, textarea, select or contenteditable */
  typing: boolean;
}

export function isSearchShortcut(e: ShortcutKeyEvent): boolean {
  if (e.altKey) return false;
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") return true;
  return e.key === "/" && !e.metaKey && !e.ctrlKey && !e.typing;
}
