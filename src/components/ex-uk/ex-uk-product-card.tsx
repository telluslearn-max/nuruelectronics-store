import { formatPrice } from "@/lib/format";
import type { Product } from "@/lib/shopify/types";
import { ProductMedia } from "@/components/product-media";
import { BookmarkIcon } from "./action-icons";
import { gradeForProduct } from "./condition-grade";
import type { Savings } from "@/lib/product-match";

/**
 * The compact teaser tile used by both SwipeCard (the deck) and ExUkGrid — deliberately minimal
 * (photo, bookmark, title/price panel only, no specs/description) to match a reference
 * "Trending" card layout: a full-bleed photo with a solid floating title/price panel and a
 * top-right bookmark, nothing else competing for space. Full specs/description only ever show in
 * ExUkProductDetail's tap-through overlay.
 */
export function ExUkProductCard({
  product,
  savings,
  bookmarked,
  onBookmark,
}: {
  product: Product;
  savings?: Savings | null;
  /** Omit onBookmark to render without the corner bookmark (no context that has one to reuse). */
  bookmarked?: boolean;
  onBookmark?: () => void;
}) {
  const image = product.images[0];
  const price = product.priceRange.minVariantPrice;
  const grade = gradeForProduct(product.tags);

  return (
    <div className="relative h-full select-none overflow-hidden rounded-[28px] bg-black shadow-xl">
      <ProductMedia
        image={image}
        title={product.title}
        productType={product.productType}
        sizes="(min-width: 640px) 384px, 90vw"
        priority
        className="object-cover"
      />

      {/* Decorative — mirrors a segmented photo-progress mark, not an interactive picker (that
          lives in ExUkProductDetail's thumbnail strip once a shopper taps through). */}
      {product.images.length > 1 && (
        <div className="absolute inset-x-4 top-4 flex gap-1" aria-hidden="true">
          {product.images.map((img, i) => (
            <span key={img.url + i} className={`h-1 flex-1 rounded-full ${i === 0 ? "bg-white" : "bg-white/30"}`} />
          ))}
        </div>
      )}

      {onBookmark && (
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onBookmark();
          }}
          aria-pressed={bookmarked}
          aria-label={bookmarked ? `Remove ${product.title} from wishlist` : `Save ${product.title} to wishlist`}
          className={`absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full shadow-sm transition ${
            bookmarked ? "bg-accent text-accent-foreground" : "bg-white/90 text-neutral-900 hover:bg-white"
          }`}
        >
          <BookmarkIcon className="h-4 w-4" filled={bookmarked} />
        </button>
      )}

      <div className="absolute inset-x-3 bottom-3 rounded-3xl bg-black/95 px-4 py-3.5 text-white">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-lg font-bold leading-snug">{product.title}</h3>
          <p className="shrink-0 text-lg font-bold">{formatPrice(price.amount, price.currencyCode)}</p>
        </div>
        <p className="mt-0.5 truncate text-xs text-white/50">
          {grade ? grade.label : "Ex-UK"} · Unboxed · 1-yr warranty
        </p>
        {savings && (
          <p className="mt-0.5 text-xs font-medium text-green-400">
            Save {formatPrice(savings.amount, savings.currencyCode)} ({savings.percent}%)
          </p>
        )}
      </div>
    </div>
  );
}
