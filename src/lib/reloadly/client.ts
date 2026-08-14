import "server-only";

// Reloadly's Gift Cards API. Verify exact paths/field names against Reloadly's
// live API reference before relying on this in production — this module was
// written from Reloadly's published API shape (OAuth2 client-credentials
// against a fixed `audience`, versioned Accept headers, a REST catalog under
// /products, order placement under /orders) without live access to fetch and
// diff their current reference docs.

const clientId = process.env.RELOADLY_CLIENT_ID;
const clientSecret = process.env.RELOADLY_CLIENT_SECRET;
const environment = process.env.RELOADLY_ENVIRONMENT === "production" ? "production" : "sandbox";

export const isReloadlyConfigured = Boolean(clientId && clientSecret);

const AUTH_URL = "https://auth.reloadly.com/oauth/token";
const API_BASE =
  environment === "production" ? "https://giftcards.reloadly.com" : "https://giftcards-sandbox.reloadly.com";
const ACCEPT_HEADER = "application/com.reloadly.giftcards-v1+json";

let cachedToken: { accessToken: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (!clientId || !clientSecret) {
    throw new Error("Reloadly isn't configured — set RELOADLY_CLIENT_ID and RELOADLY_CLIENT_SECRET.");
  }
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.accessToken;
  }

  const res = await fetch(AUTH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "client_credentials",
      audience: API_BASE,
    }),
    cache: "no-store",
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(`Reloadly auth failed: ${json.error_description ?? json.message ?? res.statusText}`);
  }

  // Reloadly's own token TTL is much longer (hours-to-days), but re-fetching a
  // little early is cheap and avoids any clock-skew edge case invalidating a
  // cached token mid-request.
  const expiresInMs = (Number(json.expires_in) || 3600) * 1000;
  cachedToken = { accessToken: json.access_token, expiresAt: Date.now() + expiresInMs - 60_000 };
  return cachedToken.accessToken;
}

async function reloadlyFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const accessToken = await getAccessToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: ACCEPT_HEADER,
      ...(init.body ? { "Content-Type": ACCEPT_HEADER } : {}),
      ...init.headers,
    },
    cache: "no-store",
  });

  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const message = json?.errors
      ? (json.errors as { message: string }[]).map((e) => e.message).join("\n")
      : (json?.message ?? res.statusText);
    throw new Error(`Reloadly API error: ${message}`);
  }
  return json as T;
}

export type ReloadlyGiftCardProduct = {
  productId: number;
  productName: string;
  global: boolean;
  denominationType: "FIXED" | "RANGE";
  recipientCurrencyCode: string;
  minRecipientDenomination: number | null;
  maxRecipientDenomination: number | null;
  fixedRecipientDenominations: number[];
  country: { isoName: string; name: string };
  redeemInstruction?: { concise: string; verbose: string };
};

type ReloadlyPage<T> = {
  content: T[];
  number: number;
  totalPages: number;
  totalElements: number;
};

/** Browse/search Reloadly's gift card catalog so staff can find the right product (e.g. a PSN Store card) without knowing its id upfront. */
export async function searchGiftCardProducts(options: {
  productName?: string;
  countryCode?: string;
  size?: number;
}): Promise<ReloadlyGiftCardProduct[]> {
  const params = new URLSearchParams();
  if (options.productName) params.set("productName", options.productName);
  if (options.countryCode) params.set("countryCode", options.countryCode);
  params.set("size", String(options.size ?? 20));

  const page = await reloadlyFetch<ReloadlyPage<ReloadlyGiftCardProduct>>(`/products?${params.toString()}`);
  return page.content;
}

export async function getGiftCardProduct(productId: number): Promise<ReloadlyGiftCardProduct> {
  return reloadlyFetch<ReloadlyGiftCardProduct>(`/products/${productId}`);
}

export type ReloadlyOrderResult = {
  transactionId: number;
  status: string;
  customIdentifier: string | null;
  amount: number;
  currencyCode: string;
};

/** Places a real gift card order against Reloadly. `customIdentifier` is the idempotency key — pass the same value on a retried call to avoid a duplicate charge. */
export async function placeGiftCardOrder(options: {
  productId: number;
  quantity: number;
  unitPrice: number;
  customIdentifier: string;
}): Promise<ReloadlyOrderResult> {
  return reloadlyFetch<ReloadlyOrderResult>("/orders", {
    method: "POST",
    body: JSON.stringify({
      productId: options.productId,
      quantity: options.quantity,
      unitPrice: options.unitPrice,
      customIdentifier: options.customIdentifier,
    }),
  });
}

export type ReloadlyOrderTransaction = ReloadlyOrderResult & {
  product: { productId: number; productName: string };
};

export async function getGiftCardOrderTransaction(transactionId: number): Promise<ReloadlyOrderTransaction> {
  return reloadlyFetch<ReloadlyOrderTransaction>(`/orders/transactions/${transactionId}`);
}

export type ReloadlyRedeemCode = {
  cardNumber: string;
  pinCode: string | null;
};

/** Fetches the redeemable code/PIN for a completed order transaction. */
export async function getGiftCardRedeemCode(transactionId: number): Promise<ReloadlyRedeemCode[]> {
  return reloadlyFetch<ReloadlyRedeemCode[]>(`/orders/transactions/${transactionId}/cards`);
}
