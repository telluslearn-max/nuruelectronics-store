import { ProductGrid } from "@/components/product-grid";
import { getProducts } from "@/lib/shopify";

export default async function HomePage() {
  const products = await getProducts();

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">All products</h1>
        <p className="mt-2 text-neutral-500">
          {products.length} {products.length === 1 ? "product" : "products"}
        </p>
      </div>
      <ProductGrid products={products} />
    </div>
  );
}
