import Image from "next/image";
import { notFound } from "next/navigation";
import { AddToCartButton } from "@/components/cart/add-to-cart-button";
import { getProductByHandle } from "@/lib/shopify";

function formatPrice(amount: string, currencyCode: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currencyCode }).format(
    Number(amount),
  );
}

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

  const image = product.images[0];
  const defaultVariant = product.variants[0];
  const price = product.priceRange.minVariantPrice;

  return (
    <div className="grid grid-cols-1 gap-10 md:grid-cols-2">
      <div className="relative aspect-square overflow-hidden rounded-lg bg-neutral-100">
        {image && (
          <Image
            src={image.url}
            alt={image.altText ?? product.title}
            fill
            className="object-cover"
            sizes="(min-width: 768px) 50vw, 100vw"
            priority
          />
        )}
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{product.title}</h1>
        <p className="mt-2 text-lg text-neutral-700">
          {formatPrice(price.amount, price.currencyCode)}
        </p>
        <p className="mt-6 text-neutral-600">{product.description}</p>

        <div className="mt-8">
          <AddToCartButton
            variantId={defaultVariant.id}
            availableForSale={defaultVariant.availableForSale}
          />
        </div>

        {product.variants.length > 1 && (
          <p className="mt-4 text-xs text-neutral-400">
            This product has multiple options; the first available variant is added by default.
          </p>
        )}
      </div>
    </div>
  );
}
