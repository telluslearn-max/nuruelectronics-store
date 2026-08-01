import "server-only";
import { getSettings } from "../settings";

export type Letterhead = {
  companyName: string;
  logoDataUri?: string;
  companyEmail?: string | null;
  companyPhone?: string | null;
  companyAddress?: string | null;
};

const PRIVATE_HOSTNAME_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^0\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^\[?::1\]?$/,
  /^\[?fe80:/i,
  /^\[?fc[0-9a-f]{2}:/i,
  /^\[?fd[0-9a-f]{2}:/i,
];

/**
 * Admin-supplied `settings.logoUrl` is fetched server-side to embed in PDFs — restrict it to
 * https and reject obvious loopback/private-network hostnames so a pasted internal URL can't be
 * used to make the server probe internal infrastructure. Not a full SSRF-proof allowlist (DNS
 * rebinding to a private IP behind a public hostname would slip through), but this is admin-only
 * input, so blocking literal private/loopback targets is a proportionate bar.
 */
function isSafeLogoUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  return !PRIVATE_HOSTNAME_PATTERNS.some((pattern) => pattern.test(parsed.hostname));
}

async function fetchLogoAsDataUri(url: string): Promise<string | undefined> {
  if (!isSafeLogoUrl(url)) return undefined;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!response.ok) return undefined;
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/") || contentType.includes("svg")) return undefined;
    const buffer = Buffer.from(await response.arrayBuffer());
    return `data:${contentType};base64,${buffer.toString("base64")}`;
  } catch {
    return undefined;
  }
}

/**
 * A bad/unreachable logo URL must never break PDF generation — the logo is
 * pre-fetched here (outside react-pdf's own render pass) so a failure just
 * falls back to the text wordmark instead of failing the whole document.
 */
export async function getLetterhead(): Promise<Letterhead> {
  const settings = await getSettings();
  const logoDataUri = settings.logoUrl ? await fetchLogoAsDataUri(settings.logoUrl) : undefined;
  return {
    companyName: settings.companyName,
    logoDataUri,
    companyEmail: settings.companyEmail,
    companyPhone: settings.companyPhone,
    companyAddress: settings.companyAddress,
  };
}
