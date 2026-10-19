"use client";

import { useCallback, useState } from "react";
import { useSearchParams } from "next/navigation";
import { usePathname, useRouter } from "@/i18n/routing";
import { EMPTY_FILTERS, filtersFromSearchParams, filtersToSearchParams } from "@/lib/admin/productFilters";
import type { ProductFilters } from "@/lib/admin/productFilters";

/**
 * The grid's filters, kept in the URL query (D4) so a filtered view survives a refresh
 * and the back button. State updates first so typing in the search box never lags.
 */
export function useProductFilters() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [filters, setState] = useState<ProductFilters>(() => filtersFromSearchParams(new URLSearchParams(searchParams.toString())));

  const write = useCallback(
    (next: ProductFilters) => {
      setState(next);
      const qs = filtersToSearchParams(next).toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router]
  );

  const setFilters = useCallback((patch: Partial<ProductFilters>) => write({ ...filters, ...patch }), [filters, write]);
  const clear = useCallback(() => write(EMPTY_FILTERS), [write]);

  return { filters, setFilters, clear };
}
