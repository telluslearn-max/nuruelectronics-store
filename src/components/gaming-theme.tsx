/**
 * Wraps the Gaming category/product pages in a dark theme, bleeding out to
 * the shared `<main>` container's edges so it reads as an intentional panel
 * rather than a smaller box floating on the (still-light) site chrome.
 */
export function GamingDarkTheme({ children }: { children: React.ReactNode }) {
  return (
    <div className="theme-gaming-dark -mx-4 rounded-3xl bg-background px-4 py-6 text-foreground sm:-mx-6 sm:px-6">
      {children}
    </div>
  );
}
