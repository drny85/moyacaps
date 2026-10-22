"use client";

import { useCallback, useState } from "react";
import { useSearchParams } from "next/navigation";
import { usePathname, useRouter } from "@/i18n/routing";
import { DEFAULT_ORDER_FILTERS, filtersFromSearchParams, filtersToSearchParams, nextFilters } from "@/lib/admin/orderFilters";
import type { OrderFilters } from "@/lib/admin/orderFilters";

/** The desk's queue, range, search, sort and page, kept in the URL (D11, plan 0013). State updates first so typing never lags. */
export function useOrderFilters() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [filters, setState] = useState<OrderFilters>(() => filtersFromSearchParams(new URLSearchParams(searchParams.toString())));

  const write = useCallback(
    (next: OrderFilters) => {
      setState(next);
      const qs = filtersToSearchParams(next).toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router]
  );

  // Any change but a page change goes back to page 1.
  const setFilters = useCallback((patch: Partial<OrderFilters>) => write(nextFilters(filters, patch)), [filters, write]);
  const clear = useCallback(() => write(DEFAULT_ORDER_FILTERS), [write]);

  return { filters, setFilters, clear };
}
