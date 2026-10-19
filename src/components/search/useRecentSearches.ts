"use client";

import { useCallback, useState } from "react";
import { parseRecent, pushRecent } from "@/lib/search/recent";

const KEY = "gl:recent-searches";

function read(): string[] {
  try {
    return parseRecent(window.localStorage.getItem(KEY));
  } catch {
    return [];
  }
}

function write(list: string[]) {
  try {
    if (list.length) window.localStorage.setItem(KEY, JSON.stringify(list));
    else window.localStorage.removeItem(KEY);
  } catch {
    // Private mode or blocked storage: recent searches are a convenience only
  }
}

/** Recent searches in this browser (plan 0006). Client-only: the overlay never renders on the server. */
export function useRecentSearches() {
  const [recent, setRecent] = useState(read);

  const remember = useCallback((query: string) => {
    setRecent((list) => {
      const next = pushRecent(list, query);
      write(next);
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    write([]);
    setRecent([]);
  }, []);

  return { recent, remember, clear };
}
