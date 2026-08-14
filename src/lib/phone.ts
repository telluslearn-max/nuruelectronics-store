/**
 * Normalizes a Kenyan phone number to the digits-only, country-code-prefixed shape this app already
 * uses for NEXT_PUBLIC_WHATSAPP_NUMBER (e.g. "2547XXXXXXXX") — accepts local (07..., 01...), +254, or
 * already-normalized input. Returns null if the input doesn't look like a Kenyan mobile number.
 */
export function normalizeKenyanPhone(input: string): string | null {
  const digits = input.replace(/[^\d]/g, "");

  if (digits.startsWith("254") && digits.length === 12) return digits;
  if (digits.startsWith("0") && digits.length === 10) return `254${digits.slice(1)}`;
  if (digits.length === 9 && (digits.startsWith("7") || digits.startsWith("1"))) return `254${digits}`;

  return null;
}
