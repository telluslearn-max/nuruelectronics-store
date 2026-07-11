import type { Product } from "@/lib/shopify/types";
import { CarouselShell } from "./carousel-shell";
import { ProductCard } from "./product-card";

export function ProductCarousel({ products }: { products: Product[] }) {
  if (products.length === 0) return null;

  return (
    <CarouselShell>
      {products.map((product) => (
        <div key={product.id} className="w-40 shrink-0 snap-start sm:w-48">
          <ProductCard product={product} />
        </div>
      ))}
    </CarouselShell>
  );
}
