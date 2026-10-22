import { Suspense } from "react";
import { CheckoutSuccess } from "@/components/checkout/CheckoutSuccess";

/**
 * Server shell: `CheckoutSuccess` reads the Stripe return params (`useSearchParams`), so it
 * renders under Suspense and the page frame paints before the browser knows the order.
 */
export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={<CheckoutSuccessSkeleton />}>
      <CheckoutSuccess />
    </Suspense>
  );
}

function CheckoutSuccessSkeleton() {
  return (
    <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16" aria-busy="true">
      <div className="flex flex-col items-center gap-4">
        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-black/5 dark:bg-white/5 animate-pulse" />
        <div className="h-10 w-72 max-w-full rounded-xl bg-black/5 dark:bg-white/5 animate-pulse" />
        <div className="h-4 w-56 max-w-full rounded bg-black/5 dark:bg-white/5 animate-pulse" />
      </div>
      <div className="mt-10 h-28 rounded-3xl bg-black/5 dark:bg-white/5 animate-pulse" />
    </div>
  );
}
