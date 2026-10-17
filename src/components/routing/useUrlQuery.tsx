"use client";

import { Suspense, useCallback, useLayoutEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";

function QuerySync({ onQuery }: { onQuery: (query: string) => void }) {
  const query = useSearchParams().toString();
  // Before paint, so a client navigation to `?colorway=…` never flashes the default
  useLayoutEffect(() => onQuery(query), [query, onQuery]);
  return null;
}

/**
 * The URL query string as component state, for statically rendered pages (ADR 0019).
 *
 * `useSearchParams` in a prerendered page makes everything up to its Suspense boundary
 * render only in the browser, which would drop the product grid and gallery (and the
 * LCP image) from the static HTML. Here the page renders with `initial` (the server and
 * hydration agree on it), and a tiny client-only `sync` element reads the real query
 * right after hydration and on every navigation. Render `sync` anywhere in the tree.
 *
 * `setQuery` updates the state and the address bar through the History API, which
 * Next.js keeps in step with `useSearchParams`, without a server round trip.
 */
export function useUrlQuery(initial = ""): [query: string, setQuery: (query: string) => void, sync: ReactNode] {
  const [query, setState] = useState(initial);

  const setQuery = useCallback((next: string) => {
    const clean = next.replace(/^\?/, "");
    setState(clean);
    window.history.replaceState(null, "", `${window.location.pathname}${clean ? `?${clean}` : ""}`);
  }, []);

  const sync = (
    <Suspense fallback={null}>
      <QuerySync onQuery={setState} />
    </Suspense>
  );

  return [query, setQuery, sync];
}
