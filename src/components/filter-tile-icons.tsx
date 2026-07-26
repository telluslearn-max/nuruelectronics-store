// Distinct per-item icons for the Gaming category's genre/collection filter tiles
// (filter-tiles.tsx) — previously every tile reused the same generic "gaming" glyph regardless of
// which genre or collection it represented, making the grid impossible to scan visually.

const GENRE_PATHS: Record<string, React.ReactNode> = {
  action: <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />,
  adventure: (
    <>
      <circle cx="10" cy="10" r="8" />
      <path d="m13 7-4 4-2 6 4-4 2-6Z" />
    </>
  ),
  casual: (
    <>
      <circle cx="10" cy="10" r="8" />
      <path d="M7 8.5h.01M13 8.5h.01M6.5 12.5c1 1.3 2.2 2 3.5 2s2.5-.7 3.5-2" />
    </>
  ),
  horror: (
    <>
      <path d="M10 2c-4.4 0-8 3.6-8 8v8l2.5-2 2 2 2-2 1.5 2 1.5-2 2 2 2-2 2.5 2v-8c0-4.4-3.6-8-8-8Z" />
      <path d="M7 9.5h.01M13 9.5h.01" />
    </>
  ),
  indie: <path d="M10 2v4M10 14v4M2 10h4M14 10h4M5 5l2.5 2.5M12.5 12.5 15 15M15 5l-2.5 2.5M4.5 15.5 7 13" />,
  racing: (
    <>
      <path d="M4 3v14M16 3v14" />
      <path d="M4 4h4v3H4V4Zm4 3h4v3H8V7Zm4-3h4v3h-4V4ZM4 10h4v3H4v-3Zm8 0h4v3h-4v-3Z" />
    </>
  ),
  rpg: (
    <>
      <path d="M6 2 4 4l8 8 2-2-8-8Z" />
      <path d="m12 12 3 3-1.5 1.5L10.5 13" />
      <path d="M3.5 14.5a2 2 0 1 0 2.83 2.83A2 2 0 0 0 3.5 14.5Z" />
    </>
  ),
  simulation: (
    <>
      <circle cx="10" cy="10" r="2.5" />
      <path d="M10 4v2M10 14v2M4 10h2M14 10h2M6 6l1.5 1.5M12.5 12.5 14 14M14 6l-1.5 1.5M5.5 14.5 7 13" />
    </>
  ),
};

const COLLECTION_PATHS: Record<string, React.ReactNode> = {
  "editors-choice": (
    <>
      <circle cx="10" cy="7" r="4.5" />
      <path d="m7 11-1.5 7L10 15.5 14.5 18 13 11" />
    </>
  ),
  "play-together": (
    <>
      <circle cx="6.5" cy="7" r="2.5" />
      <circle cx="13.5" cy="7" r="2.5" />
      <path d="M2 17c0-2.8 2-5 4.5-5s4.5 2.2 4.5 5M9 17c0-2.8 2-5 4.5-5s4.5 2.2 4.5 5" />
    </>
  ),
  "beginner-friendly": (
    <>
      <circle cx="10" cy="10" r="8" />
      <circle cx="10" cy="10" r="3" />
      <path d="m4.5 4.5 3 3M15.5 4.5l-3 3M4.5 15.5l3-3M15.5 15.5l-3-3" />
    </>
  ),
  "for-all-ages": (
    <>
      <circle cx="7" cy="6" r="2.5" />
      <circle cx="14" cy="7.5" r="2" />
      <path d="M2.5 17c0-3 2-5.5 4.5-5.5S11.5 14 11.5 17M12 17c0-2.5 1.5-4.5 3.5-4.5S18 14.5 18 17" />
    </>
  ),
};

export function FilterTileIcon({ slug, className }: { slug: string; className?: string }) {
  const path = GENRE_PATHS[slug] ?? COLLECTION_PATHS[slug];
  if (!path) return null;

  return (
    <svg viewBox="0 0 20 20" className={className} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {path}
    </svg>
  );
}
