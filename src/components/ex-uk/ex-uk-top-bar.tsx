import Link from "next/link";

export function ExUkTopBar({
  title,
  rightSlot,
  backHref = "/",
  backLabel = "NURU",
}: {
  title: string;
  rightSlot?: React.ReactNode;
  /** Defaults to the site root — pass the Ex-UK inbox/discover route for nested screens so "back" stays inside the app shell. */
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <header className="flex shrink-0 items-center justify-between border-b border-border-subtle px-4 py-3">
      <Link href={backHref} aria-label={`Back to ${backLabel}`} className="flex items-center gap-1 text-sm font-medium">
        <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 2 3 6l4.5 4" />
        </svg>
        {backLabel}
      </Link>
      <span className="text-sm font-semibold">{title}</span>
      <div className="flex w-10 justify-end">{rightSlot}</div>
    </header>
  );
}
