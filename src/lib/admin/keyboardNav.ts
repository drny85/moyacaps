export type GridKey = "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown" | "Home" | "End";

/** The card index a key moves focus to in a grid of `columns`, clamped to `count` items. */
export function nextGridIndex(index: number, key: GridKey, columns: number, count: number): number {
  if (count <= 0) return 0;
  const last = count - 1;
  switch (key) {
    case "ArrowLeft":
      return Math.max(0, index - 1);
    case "ArrowRight":
      return Math.min(last, index + 1);
    case "ArrowUp":
      return index - columns >= 0 ? index - columns : index;
    case "ArrowDown":
      if (index + columns <= last) return index + columns;
      // A partial last row below: land on its last item.
      return Math.floor(index / columns) < Math.floor(last / columns) ? last : index;
    case "Home":
      return 0;
    case "End":
      return last;
  }
}
