import { ProductEditorPage } from "@/components/admin/products/ProductEditorPage";

/** Edit one Product: `/[locale]/admin/products/[variantId]`. */
export default async function EditProductPage({ params }: { params: Promise<{ variantId: string }> }) {
  const { variantId } = await params;
  return <ProductEditorPage key={variantId} target={{ mode: "edit", variantId: decodeURIComponent(variantId) }} />;
}
