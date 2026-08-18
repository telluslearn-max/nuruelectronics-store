import "server-only";
import { isKinguinConfigured, searchKinguinProducts, type KinguinProduct } from "../gaming/kinguin-client";

// Approximate conversion: 1 EUR = ~145 KES with buffer
const EUR_TO_KES_RATE = 145;

export interface FormattedGamingCard {
  kinguinId: number;
  title: string;
  platform?: string;
  region?: string;
  priceKes: number;
  inStock: boolean;
}

export async function searchGamingVouchers(query: string, limit = 6): Promise<FormattedGamingCard[]> {
  if (!isKinguinConfigured) {
    // If Kinguin is not yet configured, return curated catalog templates
    const sampleCards: FormattedGamingCard[] = [
      { kinguinId: 101, title: "PlayStation Network (PSN) $50 Card (US)", platform: "PlayStation", region: "US", priceKes: 6500, inStock: true },
      { kinguinId: 102, title: "PlayStation Network (PSN) £25 Card (UK)", platform: "PlayStation", region: "UK", priceKes: 4200, inStock: true },
      { kinguinId: 103, title: "Steam Wallet $20 Gift Card (Global)", platform: "Steam / PC", region: "Global", priceKes: 2600, inStock: true },
      { kinguinId: 104, title: "Steam Wallet $50 Gift Card (Global)", platform: "Steam / PC", region: "Global", priceKes: 6500, inStock: true },
      { kinguinId: 105, title: "Xbox Game Pass Ultimate 1-Month (Global)", platform: "Xbox", region: "Global", priceKes: 1950, inStock: true },
      { kinguinId: 106, title: "Nintendo eShop $20 Card (US)", platform: "Nintendo", region: "US", priceKes: 2600, inStock: true },
    ];
    return sampleCards.filter(c => c.title.toLowerCase().includes(query.toLowerCase()) || query === "");
  }

  const results = await searchKinguinProducts(query, limit);
  return results.map((item: KinguinProduct) => {
    const euroAmount = item.price / 100;
    const priceKes = Math.round(euroAmount * EUR_TO_KES_RATE * 1.1); // 10% retail markup
    return {
      kinguinId: item.kinguinId,
      title: item.name,
      platform: item.platform,
      region: item.regionalLimitations || "Global",
      priceKes,
      inStock: item.qty > 0,
    };
  });
}
