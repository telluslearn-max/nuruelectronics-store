import "server-only";

export type SeasonalThemeId = "christmas";

export type SeasonalTheme = {
  id: SeasonalThemeId;
  /** Applied to the storefront layout's top-level wrapper. */
  className: string;
  announcement: {
    message: string;
    barClassName: string;
    dismissClassName: string;
  };
  decoration: "snowfall";
};

type Entry = {
  theme: SeasonalTheme;
  isActive: (now: Date) => boolean;
};

// Future seasonal themes (Valentine's, etc.) are added here as another entry —
// no other file needs to change shape to support them.
const REGISTRY: readonly Entry[] = [
  {
    theme: {
      id: "christmas",
      className: "theme-christmas",
      announcement: {
        message: "🎄 Festive season is here — free gift wrapping and priority delivery before Christmas.",
        barClassName: "bg-christmas-green text-white border-b border-christmas-gold/40",
        dismissClassName: "text-white/70 hover:text-white",
      },
      decoration: "snowfall",
    },
    // UTC deliberately — the server runtime's timezone isn't guaranteed to be Kenya's, and a
    // few hours of drift at the Dec 1 / Dec 26 boundary is invisible to shoppers.
    isActive: (now) => {
      const month = now.getUTCMonth(); // 11 = December
      const date = now.getUTCDate();
      return month === 11 && date >= 1 && date <= 26;
    },
  },
];

export function getActiveSeasonalTheme(now: Date = new Date()): SeasonalTheme | null {
  return REGISTRY.find((entry) => entry.isActive(now))?.theme ?? null;
}
