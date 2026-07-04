import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductGallery } from "@/components/product-gallery";
import { ProductOptions } from "@/components/product-options";
import { getProductByHandle } from "@/lib/shopify";

type ProductPageProps = {
  params: Promise<{ handle: string }>;
};

function truncate(text: string, maxLength: number) {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trimEnd()}…`;
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { handle } = await params;
  const product = await getProductByHandle(handle);
  if (!product) return {};

  const description = truncate(product.description, 155);
  const image = product.images[0];

  return {
    title: product.title,
    description,
    openGraph: {
      title: product.title,
      description,
      images: image ? [{ url: image.url }] : undefined,
    },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { handle } = await params;
  const product = await getProductByHandle(handle);

  if (!product) {
    notFound();
  }

  const price = product.priceRange.minVariantPrice;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.description,
    image: product.images.map((image) => image.url),
    offers: {
      "@type": "Offer",
      price: price.amount,
      priceCurrency: price.currencyCode,
      availability: product.availableForSale
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
    },
  };

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
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
