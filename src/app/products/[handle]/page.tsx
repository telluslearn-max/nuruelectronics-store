import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductGallery } from "@/components/product-gallery";
import { ProductOptions } from "@/components/product-options";
import { getProductByHandle } from "@/lib/shopify";

export default async function ProductPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const product = await getProductByHandle(handle);

  if (!product) {
    notFound();
  }

  return (
    <div>
      <Link href="/" className="text-sm text-neutral-500 hover:text-foreground">
        &larr; Back to shop
      </Link>

      <div className="mt-4 grid grid-cols-1 gap-10 md:grid-cols-2">
        <ProductGallery images={product.images} title={product.title} />

        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{product.title}</h1>
          <ProductOptions product={product} />
          <p className="mt-8 border-t border-border-subtle pt-6 text-neutral-600">
            {product.description}
          </p>
        </div>
      </div>
    </div>
  );
}
