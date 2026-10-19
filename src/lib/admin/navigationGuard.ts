/**
 * Whether a link click would leave the editor for another in-app page, so the
 * unsaved-changes guard must ask first. Clicks the browser opens elsewhere (new tab,
 * download, modifier keys, another site) and links to the same page pass through.
 */
export function shouldGuardClick(
  link: { href: string; target?: string; download?: boolean },
  mods: { meta: boolean; ctrl: boolean; shift: boolean; alt: boolean; button: number },
  currentUrl: string
): boolean {
  if (mods.button !== 0 || mods.meta || mods.ctrl || mods.shift || mods.alt) return false;
  if (link.download || (link.target && link.target !== "_self")) return false;
  const here = new URL(currentUrl);
  const to = new URL(link.href, here);
  if (to.origin !== here.origin) return false;
  return to.pathname !== here.pathname || to.search !== here.search;
}
