import "server-only";

const isProduction = process.env.KINGUIN_ENV === "production";
const KINGUIN_GATEWAY = isProduction
  ? "https://gateway.kinguin.net/esa/api/v2"
  : "https://sandbox.gateway.kinguin.net/esa/api/v2";

const clientId = process.env.KINGUIN_CLIENT_ID;
const clientSecret = process.env.KINGUIN_CLIENT_SECRET;

export const isKinguinConfigured = Boolean(clientId && clientSecret);

let cachedToken: string | null = null;
let tokenExpiresAt = 0;

export interface KinguinProduct {
  kinguinId: number;
  name: string;
  originalName?: string;
  platform?: string;
  qty: number;
  price: number; // in eurocents
  regionalLimitations?: string;
  regionId?: number;
  coverImage?: string;
  coverImageOriginal?: string;
}

export interface KinguinOrderResult {
  orderId: string;
  status: "completed" | "processing" | "failed";
  serialKeys: string[];
  totalPriceEurocents: number;
}

async function getKinguinToken(): Promise<string> {
  if (!isKinguinConfigured) {
    throw new Error("Kinguin API is not configured — KINGUIN_CLIENT_ID and KINGUIN_CLIENT_SECRET are unset.");
  }

  if (cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken;
  }

  const res = await fetch(`${KINGUIN_GATEWAY}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId!,
      client_secret: clientSecret!,
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Kinguin OAuth failed (${res.status}): ${errorText}`);
  }

  const data = await res.json();
  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + ((data.expires_in ?? 3600) - 60) * 1000;
  return cachedToken!;
}

/**
 * Search the live Kinguin digital catalog by product name, platform, or tags.
 */
export async function searchKinguinProducts(query: string, limit = 10): Promise<KinguinProduct[]> {
  if (!isKinguinConfigured) return [];

  try {
    const token = await getKinguinToken();
    const url = new URL(`${KINGUIN_GATEWAY}/products`);
    url.searchParams.set("name", query);
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("page", "1");

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) return [];

    const json = await res.json();
    const items = json.results || json.data || [];
    return items.map((item: Record<string, unknown>) => ({
      kinguinId: Number(item.kinguinId || item.id),
      name: String(item.name || ""),
      originalName: item.originalName ? String(item.originalName) : undefined,
      platform: item.platform ? String(item.platform) : undefined,
      qty: Number(item.qty || item.quantity || 0),
      price: Number(item.price || 0),
      regionalLimitations: item.regionalLimitations ? String(item.regionalLimitations) : undefined,
      regionId: item.regionId ? Number(item.regionId) : undefined,
      coverImage: item.coverImage ? String(item.coverImage) : undefined,
      coverImageOriginal: item.coverImageOriginal ? String(item.coverImageOriginal) : undefined,
    }));
  } catch (error) {
    console.error("Kinguin search failed:", error);
    return [];
  }
}

/**
 * Place a real-time order for a digital game key / gift card PIN on Kinguin.
 */
export async function orderKinguinKey(kinguinId: number, maxPriceEurocents: number): Promise<KinguinOrderResult> {
  const token = await getKinguinToken();

  const res = await fetch(`${KINGUIN_GATEWAY}/order`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      products: [
        {
          kinguinId,
          qty: 1,
          price: maxPriceEurocents,
        },
      ],
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Kinguin order rejected (${res.status}): ${err}`);
  }

  const json = await res.json();
  const keys: string[] = [];
  if (Array.isArray(json.keys)) {
    for (const k of json.keys) {
      if (typeof k === "string") keys.push(k);
      else if (k && typeof k === "object" && "serial" in k) keys.push(String(k.serial));
    }
  }

  return {
    orderId: String(json.orderId || json.id || `KNG-${Date.now()}`),
    status: json.status === "completed" ? "completed" : "processing",
    serialKeys: keys,
    totalPriceEurocents: maxPriceEurocents,
  };
}

/**
 * Get current Kinguin wholesale wallet balance.
 */
export async function getKinguinBalance(): Promise<{ balanceEurocents: number; currency: string }> {
  if (!isKinguinConfigured) return { balanceEurocents: 0, currency: "EUR" };

  const token = await getKinguinToken();
  const res = await fetch(`${KINGUIN_GATEWAY}/user/balance`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) return { balanceEurocents: 0, currency: "EUR" };
  const json = await res.json();
  return {
    balanceEurocents: Number(json.balance || 0),
    currency: String(json.currency || "EUR"),
  };
}
