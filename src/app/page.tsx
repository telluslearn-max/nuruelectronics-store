import { ProductGrid } from "@/components/product-grid";
import { getProducts } from "@/lib/shopify";

export default async function HomePage() {
  const products = await getProducts();

  return (
    <div>
      <h1 className="mb-8 text-2xl font-semibold tracking-tight">All products</h1>
      <ProductGrid products={products} />
    </div>
  );
}
