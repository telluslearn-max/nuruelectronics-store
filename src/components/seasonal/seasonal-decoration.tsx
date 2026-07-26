import type { SeasonalTheme } from "@/lib/seasonal-theme";
import { Snowfall } from "./snowfall";

const DECORATIONS: Record<SeasonalTheme["decoration"], () => React.ReactElement> = {
  snowfall: Snowfall,
};

export function SeasonalDecoration({ theme }: { theme: SeasonalTheme | null }) {
  if (!theme) return null;
  const Decoration = DECORATIONS[theme.decoration];
  return <Decoration />;
}
