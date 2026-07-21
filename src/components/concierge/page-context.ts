import type { ConciergePageContext } from "@/lib/concierge/types";

const PRODUCT_PATH = /^\/products\/([^/]+)/;

/** Derives what the concierge should know about the current page from the URL alone. */
export function getPageContext(pathname: string): ConciergePageContext {
  const match = pathname.match(PRODUCT_PATH);
  return match ? { productHandle: match[1] } : {};
}
