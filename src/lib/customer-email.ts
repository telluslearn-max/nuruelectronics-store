/**
 * Customer.email is a required, unique Prisma field, but manual orders (e.g. off-platform
 * WhatsApp sales) often have no real customer email — only a phone number or a name. Rather
 * than making the schema field nullable (and rippling that through every place that treats
 * customer.email as a mailable address), staff can leave email blank and we synthesize a
 * deterministic placeholder under a domain reserved by RFC 2606 for "known invalid" addresses,
 * so nothing ever actually attempts to send mail there.
 */
const SYNTHETIC_EMAIL_DOMAIN = "no-email.invalid";

function slugify(seed: string): string {
  return seed
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Deterministic placeholder email for a customer identified only by phone or name. */
export function syntheticCustomerEmail(seed: string): string {
  const slug = slugify(seed) || "customer";
  return `${slug}@${SYNTHETIC_EMAIL_DOMAIN}`;
}

export function isSyntheticEmail(email: string | null | undefined): boolean {
  return Boolean(email && email.toLowerCase().endsWith(`@${SYNTHETIC_EMAIL_DOMAIN}`));
}

/** True only for a real, mailable address — false for both empty and synthetic placeholder emails. */
export function hasRealEmail(email: string | null | undefined): boolean {
  return Boolean(email) && !isSyntheticEmail(email);
}

/** The email to actually show to staff/customers — null (not the ugly placeholder) when synthetic. */
export function displayEmail(email: string | null | undefined): string | null {
  if (!email || isSyntheticEmail(email)) return null;
  return email;
}
