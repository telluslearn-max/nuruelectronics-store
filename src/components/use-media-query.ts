"use client";

import { useEffect, useState } from "react";

/**
 * Tracks whether a media query currently matches. Used to pair a Tailwind responsive
 * `hidden`/`md:block`-style layout (mobile and desktop each get their own DOM copy of a
 * component, CSS-toggled per breakpoint) with a matching `aria-hidden` on whichever copy isn't
 * currently shown — CSS `display:none` alone excludes an element from the accessibility tree in
 * every modern browser+AT combination, but some automated accessibility scanners don't fully
 * evaluate responsive CSS and see both copies as live, identically-labeled landmarks (audit
 * finding L2).
 *
 * Returns `undefined` until mounted, rather than guessing `false` — the real viewport is unknown
 * during SSR and the pre-hydration window, and asserting a guessed value there previously meant
 * the *visible* (desktop) copy could render `aria-hidden="true"` on an actual desktop viewport
 * for that whole window, which is worse than not asserting anything (CSS `display:none` alone
 * already keeps assistive tech to one copy in that window, per the reasoning above).
 */
export function useMediaQuery(query: string): boolean | undefined {
  const [matches, setMatches] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    const mediaQueryList = window.matchMedia(query);
    // Intentional: window.matchMedia doesn't exist during SSR/pre-hydration (see the function
    // comment above on why `undefined` is the deliberate initial value), so there is no
    // render-time way to read this — it has to happen in an effect on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMatches(mediaQueryList.matches);
    function handleChange(event: MediaQueryListEvent) {
      setMatches(event.matches);
    }
    mediaQueryList.addEventListener("change", handleChange);
    return () => mediaQueryList.removeEventListener("change", handleChange);
  }, [query]);

  return matches;
}
