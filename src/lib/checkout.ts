const MOCK_CHECKOUT_HOST = "example-mock-checkout.myshopify.com";

/**
 * True once `checkoutUrl` is a real Shopify checkout link rather than the mock-mode placeholder
 * (`https://example-mock-checkout.myshopify.com/...`) that `getProducts`/cart mutations fall back
 * to in src/lib/shopify/index.ts when `SHOPIFY_STORE_DOMAIN`/`SHOPIFY_STOREFRONT_ACCESS_TOKEN`
 * aren't configured. That placeholder domain doesn't resolve for a real shopper — sending them to
 * it as the default "Checkout" action silently breaks the store's primary purchase path (audit
 * finding C3). Anywhere a checkout link is offered should check this first and fall back to a
 * WhatsApp order CTA instead of linking to a dead URL.
 */
export function isCheckoutUsable(checkoutUrl: string | undefined | null): boolean {
  if (!checkoutUrl) return false;
  try {
    return new URL(checkoutUrl).hostname !== MOCK_CHECKOUT_HOST;
  } catch {
    return false;
  }
}
