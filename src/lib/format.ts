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
