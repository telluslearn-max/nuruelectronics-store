/**
 * Literal color values for places that can't reference globals.css's CSS custom properties:
 * `next/og`'s Satori renderer (opengraph-image.tsx routes) and the PWA manifest's `theme_color`.
 * Mirrors --surface-dark / --surface-dark-foreground / --accent in globals.css — kept here as a
 * single constants module instead of the same hex values repeated in every file, so the OG/manifest
 * palette can't silently drift from the design tokens if either one changes.
 */
export const OG_THEME = {
  background: "#0a0a0a",
  foreground: "#f5f5f7",
  accent: "#d4472e",
  muted: "#a1a1aa",
} as const;
