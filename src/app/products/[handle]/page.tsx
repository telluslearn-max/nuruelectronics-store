import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductCard } from "@/components/product-card";
import { ProductGallery } from "@/components/product-gallery";
import { ProductOptions } from "@/components/product-options";
import { categoryForProductType } from "@/lib/categories";
import { getProductByHandle, getProducts } from "@/lib/shopify";
import type { Product } from "@/lib/shopify/types";

async function getRelatedProducts(product: Product): Promise<Product[]> {
  const collectionTag = product.tags.find((tag) => tag.startsWith("collection-"));
  if (!collectionTag) return [];
  const { products } = await getProducts({ searchTerm: `tag:${collectionTag}`, first: 5 });
  return products.filter((p) => p.handle !== product.handle).slice(0, 4);
}

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
  const category = categoryForProductType(product.productType);
  const related = await getRelatedProducts(product);
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
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://www.nuruelectronics.com" },
      ...(category
        ? [
            {
              "@type": "ListItem",
              position: 2,
              name: category.label,
              item: `https://www.nuruelectronics.com/category/${category.slug}`,
            },
          ]
        : []),
      { "@type": "ListItem", position: category ? 3 : 2, name: product.title },
    ],
  };

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <nav aria-label="Breadcrumb" className="text-sm text-neutral-500">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href="/" className="hover:text-foreground">
              Home
            </Link>
          </li>
          {category && (
            <li className="flex items-center gap-1.5">
              <span aria-hidden="true">/</span>
              <Link href={`/category/${category.slug}`} className="hover:text-foreground">
                {category.label}
              </Link>
            </li>
          )}
          <li className="flex items-center gap-1.5">
            <span aria-hidden="true">/</span>
            <span aria-current="page" className="text-foreground">
              {product.title}
            </span>
          </li>
        </ol>
      </nav>

      <div className="mt-4 grid grid-cols-1 gap-10 md:grid-cols-2">
        <ProductGallery
          images={product.images}
          title={product.title}
          productType={product.productType}
        />

        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{product.title}</h1>
          <ProductOptions product={product} />
          <div
            className="mt-8 border-t border-border-subtle pt-6 text-neutral-600 [&_a]:text-accent [&_a]:underline [&_a]:underline-offset-2 [&_a]:hover:opacity-80 [&_li]:mb-1 [&_p]:mb-4 [&_p:last-child]:mb-0 [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-5"
            dangerouslySetInnerHTML={{ __html: product.descriptionHtml }}
          />
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-16">
          <h2 className="text-title">You may also like</h2>
          <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 lg:grid-cols-4">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
