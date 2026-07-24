import { genreForProductTags } from "@/lib/categories";
import type { Product } from "@/lib/shopify/types";

function IconFrame({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-card border border-border-subtle text-neutral-500">
      {children}
    </span>
  );
}

function GenreIcon() {
  return (
    <IconFrame>
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 2.5 14 8l5.5 1-4 4 1 5.5-4.5-2.5-4.5 2.5 1-5.5-4-4L9 8z" />
      </svg>
    </IconFrame>
  );
}

function GlobeIcon() {
  return (
    <IconFrame>
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c2.5 2.5 3.8 5.7 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.7-3.8-9S9.5 5.5 12 3Z" />
      </svg>
    </IconFrame>
  );
}

function ControllerIcon() {
  return (
    <IconFrame>
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="2.5" y="8" width="19" height="9" rx="4.5" />
        <path d="M7 10.5v4M5 12.5h4" />
        <circle cx="15.5" cy="11" r="0.75" fill="currentColor" stroke="none" />
        <circle cx="18" cy="13.5" r="0.75" fill="currentColor" stroke="none" />
      </svg>
    </IconFrame>
  );
}

function AgeBadge({ value }: { value: string }) {
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-card bg-accent text-xs font-bold text-accent-foreground">
      {value}
    </span>
  );
}

/**
 * Icon + label rows for a game product — genre, age rating, supported
 * language count, multiplayer mode — mirroring the reference storefront's
 * per-item tag row. Only renders rows the product actually has data for.
 */
type TagRow = { key: string; icon: React.ReactNode; label: string };

export function GameTags({ product }: { product: Product }) {
  const specMap = new Map((product.specs ?? []).map((s) => [s.key, s.value]));
  const genre = genreForProductTags(product.tags);
  const ageRating = specMap.get("age_rating");
  const languages = specMap.get("languages");
  const languageCount = languages ? languages.split(",").filter((l) => l.trim().length > 0).length : 0;
  const multiplayer = specMap.get("multiplayer");

  const candidates: (TagRow | false | undefined | "")[] = [
    genre && { key: "genre", icon: <GenreIcon />, label: genre.label },
    ageRating && { key: "age", icon: <AgeBadge value={ageRating} />, label: `Rated ${ageRating}` },
    languageCount > 0 && {
      key: "languages",
      icon: <GlobeIcon />,
      label: `${languageCount} supported language${languageCount === 1 ? "" : "s"}`,
    },
    multiplayer && { key: "multiplayer", icon: <ControllerIcon />, label: multiplayer },
  ];
  const rows = candidates.filter((row): row is TagRow => Boolean(row));

  if (rows.length === 0) return null;

  return (
    <div className="mt-8 divide-y divide-border-subtle border-y border-border-subtle">
      {rows.map((row) => (
        <div key={row.key} className="flex items-center gap-3 py-3">
          {row.icon}
          <p className="text-sm">{row.label}</p>
        </div>
      ))}
    </div>
  );
}
