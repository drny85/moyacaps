import { Suspense } from "react";
import { ProductGrid } from "@/components/admin/products/ProductGrid";
import { ProductGridSkeleton } from "@/components/admin/products/ProductGridSkeleton";
import { CategoryLaunchCard } from "@/components/admin/CategoryLaunchCard";

/** Admin product list: filters live in the URL query, so the grid reads `useSearchParams` under Suspense. */
export default function AdminProductsPage() {
  return (
    <>
      <div className="px-4 sm:px-8 pt-6 max-w-7xl mx-auto w-full">
        <CategoryLaunchCard />
      </div>
      <Suspense fallback={<ProductGridSkeleton />}>
        <ProductGrid />
      </Suspense>
    </>
  );
}
