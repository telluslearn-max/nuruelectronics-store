import { SITE_URL } from "@/lib/site";

export const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER;

export function buildWhatsAppUrl(message: string): string | null {
  if (!WHATSAPP_NUMBER) return null;
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

export function productUrl(productHandle: string): string {
  return `${SITE_URL}/products/${productHandle}`;
}
