import { describe, expect, it, vi } from "vitest";
import { readSoundPreference, SOUND_PREF_KEY, subscribeSoundPreference, writeSoundPreference } from "./soundPreference";

const storage = (initial: Record<string, string> = {}) => {
  const data = { ...initial };
  return {
    getItem: (k: string) => data[k] ?? null,
    setItem: (k: string, v: string) => {
      data[k] = v;
    },
    data,
  };
};

describe("sound preference", () => {
  it("defaults to enabled when nothing is stored", () => {
    expect(readSoundPreference(storage())).toBe(true);
    expect(readSoundPreference(null)).toBe(true);
  });

  it("reads false", () => {
    expect(readSoundPreference(storage({ [SOUND_PREF_KEY]: "false" }))).toBe(false);
  });

  it("write stores and notifies subscribers in the same tab", () => {
    const s = storage();
    const target = new EventTarget();
    const seen: boolean[] = [];
    const unsubscribe = subscribeSoundPreference(target, (enabled) => seen.push(enabled));
    writeSoundPreference(s, false, target);
    expect(s.data[SOUND_PREF_KEY]).toBe("false");
    expect(seen).toEqual([false]);
    unsubscribe();
    writeSoundPreference(s, true, target);
    expect(seen).toEqual([false]);
    vi.restoreAllMocks();
  });
});
