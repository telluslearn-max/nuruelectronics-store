import Link from "next/link";
import { formatPrice } from "@/lib/format";
import type { Money } from "@/lib/shopify/types";

/** Shown on a regular product page when the same model is also available cheaper, Ex-UK. */
export function ExUkCrossSellBanner({ handle, price }: { handle: string; price: Money }) {
  return (
    <Link
      href={`/ex-uk?highlight=${handle}`}
      className="mt-6 flex items-center justify-between gap-3 rounded-card border border-accent/30 bg-accent/5 px-4 py-3 text-sm transition hover:border-accent/60"
    >
      <span>
        Also available <span className="font-medium">Ex-UK</span> (unboxed, 1-year warranty) from{" "}
        <span className="font-semibold">{formatPrice(price.amount, price.currencyCode)}</span>
      </span>
      <span aria-hidden="true" className="shrink-0 text-accent">
        →
      </span>
    </Link>
  );
}
