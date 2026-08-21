export function truncate(text: string, maxLength: number) {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trimEnd()}…`;
}

export function formatPrice(amount: string, currencyCode: string) {
  const value = Number(amount);
  const isWhole = Number.isInteger(value);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: isWhole ? 0 : 2,
    maximumFractionDigits: isWhole ? 0 : 2,
  }).format(value);
}

/** These pages are server-rendered, so a bare `.toLocaleString()` reports the server runtime's
 * timezone (UTC on Vercel), not the Nairobi-based admin's — NURU is a Kenyan business, so every
 * admin-facing timestamp should read in East Africa Time regardless of where the request happens
 * to execute. */
export function formatEatDateTime(date: Date): string {
  return `${date.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Nairobi" })} EAT`;
}

export function formatEatDate(date: Date): string {
  return date.toLocaleDateString("en-US", { dateStyle: "medium", timeZone: "Africa/Nairobi" });
}
