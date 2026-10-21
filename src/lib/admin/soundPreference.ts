/** The order-chime preference: stored per browser, changed on Settings, heard by the admin shell (plan 0009 D19/D20). */

export const SOUND_PREF_KEY = "moya_admin_sound";
const EVENT = "moya-admin-sound";

type Readable = Pick<Storage, "getItem">;
type Writable = Pick<Storage, "setItem">;

/** Enabled unless the stored value is exactly "false". */
export function readSoundPreference(storage: Readable | null): boolean {
  try {
    return storage?.getItem(SOUND_PREF_KEY) !== "false";
  } catch {
    return true;
  }
}

/** Store the preference and tell every listener on `target` in this tab. */
export function writeSoundPreference(storage: Writable, enabled: boolean, target?: EventTarget | null): void {
  try {
    storage.setItem(SOUND_PREF_KEY, String(enabled));
  } catch {
    // Private mode or blocked storage: the in-tab event still reaches the shell.
  }
  target?.dispatchEvent(new CustomEvent<boolean>(EVENT, { detail: enabled }));
}

/** Listen for in-tab changes; returns the unsubscribe function. */
export function subscribeSoundPreference(target: EventTarget, cb: (enabled: boolean) => void): () => void {
  const handler = (e: Event) => cb((e as CustomEvent<boolean>).detail);
  target.addEventListener(EVENT, handler);
  return () => target.removeEventListener(EVENT, handler);
}
