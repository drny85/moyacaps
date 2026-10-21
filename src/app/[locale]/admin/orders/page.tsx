import { Suspense } from "react";
import { OrdersList } from "@/components/admin/orders/OrdersList";
import { OrdersSkeleton } from "@/components/admin/orders/OrdersSkeleton";

/** Admin Orders desk: filters live in the URL query, so the list reads `useSearchParams` under Suspense. */
export default function AdminOrdersPage() {
  return (
    <Suspense fallback={<OrdersSkeleton />}>
      <OrdersList />
    </Suspense>
  );
}
