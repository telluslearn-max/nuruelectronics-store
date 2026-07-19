import "server-only";

export const DEFAULT_PAGE_SIZE = 25;

export type PageSearchParams = Record<string, string | string[] | undefined>;

export interface PageInfo {
  page: number;
  skip: number;
  take: number;
}

/**
 * Reads `?page=` from a resolved Next.js searchParams object. Invalid or
 * missing values fall back to page 1 rather than erroring.
 */
export function parsePage(searchParams: PageSearchParams, pageSize = DEFAULT_PAGE_SIZE): PageInfo {
  const raw = searchParams.page;
  const value = Array.isArray(raw) ? raw[0] : raw;
  const parsed = Number.parseInt(value ?? "1", 10);
  const page = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  return { page, skip: (page - 1) * pageSize, take: pageSize };
}

/**
 * Builds an href for `pathname` that carries over every current search param
 * except `page`, then sets `page` to the target page (omitted for page 1).
 */
export function buildPageHref(pathname: string, searchParams: PageSearchParams, page: number): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (key === "page" || value === undefined) continue;
    if (Array.isArray(value)) {
      for (const entry of value) params.append(key, entry);
    } else {
      params.append(key, value);
    }
  }
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}
