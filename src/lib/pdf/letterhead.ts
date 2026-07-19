import "server-only";
import { getSettings } from "../settings";

export type Letterhead = { companyName: string; logoDataUri?: string };

async function fetchLogoAsDataUri(url: string): Promise<string | undefined> {
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
  return { companyName: settings.companyName, logoDataUri };
}
