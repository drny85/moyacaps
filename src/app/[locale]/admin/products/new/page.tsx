import { ProductEditorPage } from "@/components/admin/products/ProductEditorPage";

/** Create a Product: `/[locale]/admin/products/new?category=headwear|apparel` (Cap by default). */
export default async function NewProductPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const { category } = await searchParams;
  return <ProductEditorPage key={category} target={{ mode: "new", category: category === "apparel" ? "apparel" : "headwear" }} />;
}
