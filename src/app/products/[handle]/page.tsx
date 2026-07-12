import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BuyersGuide } from "@/components/buyers-guide";
import { BuyItWith } from "@/components/buy-it-with";
import { Faq, type FaqItem } from "@/components/faq";
import { ProductCompareTable } from "@/components/product-compare-table";
import { ProductGallery } from "@/components/product-gallery";
import { ProductOptions } from "@/components/product-options";
import { ProductSpecs } from "@/components/product-specs";
import { OriginGuide } from "@/components/origin-guide";
import { RelatedCategories } from "@/components/related-categories";
import { categoryForProductType, getRelatedCategories } from "@/lib/categories";
import { ecosystemTagForProduct } from "@/lib/collections";
import { getBuyersGuide } from "@/lib/buyers-guides";
import { getOriginOptionValues, hasEsimOnlyWarranty } from "@/lib/origin-options";
import { getProductByHandle, getProducts } from "@/lib/shopify";
import type { Product } from "@/lib/shopify/types";
import { buildSpecsGuide } from "@/lib/spec-glossary";

const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER;

async function getRelatedProducts(product: Product): Promise<Product[]> {
  const collectionTag = product.tags.find((tag) => tag.startsWith("collection-"));
  if (!collectionTag) return [];
  const { products } = await getProducts({
    searchTerm: `tag:${collectionTag}`,
    first: 5,
    includeSpecs: true,
  });
  return products.filter((p) => p.handle !== product.handle).slice(0, 4);
}

/**
 * Cross-sell products for a related category, scoped to the anchor product's
 * own brand ecosystem when it has one (an iPhone's "pairs with" wearable
 * should be an Apple Watch, not a Galaxy Watch). Falls back to the
 * unscoped category query when the brand doesn't stock that category, so
 * generic/third-party categories (chargers, accessories) still populate.
 */
async function getEcosystemScopedCategoryProducts(categoryQuery: string, ecosystemTag: string | undefined) {
  if (ecosystemTag) {
    const scoped = await getProducts({
      searchTerm: `(${categoryQuery}) AND tag:${ecosystemTag}`,
      sortKey: "BEST_SELLING",
      first: 8,
    });
    if (scoped.products.length > 0) return scoped;
  }
  return getProducts({ searchTerm: categoryQuery, sortKey: "BEST_SELLING", first: 8 });
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
      images: [{ url: image ? image.url : `/products/${handle}/opengraph-image` }],
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
  const relatedEdges = category ? getRelatedCategories(category.slug) : [];
  const ecosystemTag = ecosystemTagForProduct(product.tags);
  const specsGuide = buildSpecsGuide(product.specs ?? []);
  // Apple encodes this as a "Warranty" option (with SIM/eSIM/FaceTime text);
  // Samsung encodes the same Africa-vs-Dubai distinction as a bare "Source"
  // option with no SIM/eSIM claims, since that isn't confirmed for
  // Samsung's imported stock. OriginGuide renders whichever facts exist.
  const originOption = getOriginOptionValues(product.options);
  // No product is manually tagged "esim" yet, so trigger the eSIM setup
  // guide off real signals instead: an "eSIM Only" warranty-option value,
  // or simply being an iPhone — every iPhone 13 and later supports eSIM,
  // not just the units this catalog imports as eSIM-only.
  const supportsEsim = hasEsimOnlyWarranty(product.options) || product.tags.includes("iphone");
  const buyersGuide = getBuyersGuide(supportsEsim ? [...product.tags, "esim"] : product.tags);

  const [related, relatedCategoryPages] = await Promise.all([
    getRelatedProducts(product),
    Promise.all(
      relatedEdges.map((edge) =>
        getEcosystemScopedCategoryProducts(edge.category.query, ecosystemTag),
      ),
    ),
  ]);

  const relatedCategories = relatedEdges
    .map((edge, i) => ({
      label: edge.category.label,
      slug: edge.category.slug,
      reason: edge.reason,
      products: relatedCategoryPages[i]?.products ?? [],
    }))
    .filter((entry) => entry.products.length > 0);

  // Reuses the same mesh cross-sell data already fetched above — one real
  // product per related category, not a fabricated "frequently bought" claim.
  const bundleExtras = relatedCategories.map((rc) => rc.products[0]).filter((p): p is Product => Boolean(p));

  // Contextual to this exact product — points at the WhatsApp button and
  // options picker actually on this page, rather than sending shoppers
  // elsewhere for something they're already looking at.
  const hasVariants = product.options.some((option) => option.values.length > 1);
  const productFaqs: FaqItem[] = [
    {
      q: "Is this genuine and covered by warranty?",
      a: "Yes — every product we sell is checked for authenticity before it ships and comes with manufacturer warranty.",
    },
    {
      q: "How fast can I get this delivered?",
      a: "Same-day delivery in Nairobi, with countrywide shipping available across Kenya.",
    },
    ...(WHATSAPP_NUMBER
      ? [
          {
            q: "Can I order this via WhatsApp instead?",
            a: "Yes — use the WhatsApp button above to order this exact item directly, no checkout required.",
          },
        ]
      : []),
    ...(hasVariants
      ? [
          {
            q: "Can I pick a different color or storage?",
            a: "Use the options above to choose the configuration you want before adding to cart.",
          },
        ]
      : []),
  ];
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
          <h1 className="text-title">{product.title}</h1>
          <ProductOptions product={product} />
          <div
            className="mt-8 border-t border-border-subtle pt-6 text-neutral-600 [&_a]:text-accent [&_a]:underline [&_a]:underline-offset-2 [&_a]:hover:opacity-80 [&_li]:mb-1 [&_p]:mb-4 [&_p:last-child]:mb-0 [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-5"
            dangerouslySetInnerHTML={{ __html: product.descriptionHtml }}
          />
        </div>
      </div>

      {originOption && <OriginGuide optionName={originOption.optionName} values={originOption.values} />}

      {buyersGuide && <BuyersGuide guide={buyersGuide} />}

      <BuyItWith current={product} extras={bundleExtras} />

      <ProductSpecs specs={product.specs ?? []} />

      {specsGuide.length > 0 && (
        <section className="mt-16">
          <h2 className="text-title">Understanding the specs</h2>
          <p className="mt-2 text-neutral-500">
            What these numbers actually mean for how you&apos;ll use it.
          </p>
          <div className="mt-6">
            <Faq items={specsGuide} />
          </div>
        </section>
      )}

      {related.length > 0 && (
        <section className="mt-16">
          <h2 className="text-title">Compare with the lineup</h2>
          <p className="mt-2 text-neutral-500">
            See how this stacks up against other options in the same series.
          </p>
          <div className="mt-6">
            <ProductCompareTable current={product} related={related} />
          </div>
        </section>
      )}

      <RelatedCategories title={category?.label ?? product.title} items={relatedCategories} />

      <section className="mt-16">
        <h2 className="text-title">Common questions</h2>
        <div className="mt-6">
          <Faq items={productFaqs} />
        </div>
      </section>
    </div>
  );
}
