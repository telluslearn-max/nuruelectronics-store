import { ProductList } from "@/components/product-list";
import { getProducts } from "@/lib/shopify";

export default async function HomePage() {
  const { products, hasNextPage, endCursor } = await getProducts();

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">All products</h1>
      </div>
      <ProductList
        initialProducts={products}
        initialHasNextPage={hasNextPage}
        initialEndCursor={endCursor}
      />
    </div>
  );
}
