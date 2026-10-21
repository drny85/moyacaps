/**
 * Scroll an element to the middle of the viewport. Lenis (SmoothScrollProvider) owns window
 * scrolling where it runs and swallows a native `scrollIntoView`, so go through it when present.
 */

type LenisLike = { scrollTo: (target: unknown, options: { offset: number }) => void };
type Scrollable = { getBoundingClientRect: () => { height: number }; scrollIntoView: (options: ScrollIntoViewOptions) => void };

export function scrollToElement(
  el: Scrollable,
  {
    lenis = typeof window === "undefined" ? undefined : (window as unknown as { __lenis?: LenisLike }).__lenis,
    viewportHeight = typeof window === "undefined" ? 0 : window.innerHeight,
  }: { lenis?: LenisLike; viewportHeight?: number } = {}
): void {
  if (lenis) lenis.scrollTo(el, { offset: -Math.round((viewportHeight - el.getBoundingClientRect().height) / 2) });
  else el.scrollIntoView({ behavior: "smooth", block: "center" });
}
