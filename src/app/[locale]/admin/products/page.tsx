import { Suspense } from "react";
import { ProductGrid } from "@/components/admin/products/ProductGrid";
import { ProductGridSkeleton } from "@/components/admin/products/ProductGridSkeleton";

/** Admin product list: filters live in the URL query, so the grid reads `useSearchParams` under Suspense. */
export default function AdminProductsPage() {
  return (
    <Suspense fallback={<ProductGridSkeleton />}>
      <ProductGrid />
    </Suspense>
  );
}
