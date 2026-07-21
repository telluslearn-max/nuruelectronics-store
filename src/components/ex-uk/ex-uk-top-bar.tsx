import Link from "next/link";

export function ExUkTopBar({ title, rightSlot }: { title: string; rightSlot?: React.ReactNode }) {
  return (
    <header className="flex shrink-0 items-center justify-between border-b border-border-subtle px-4 py-3">
      <Link href="/" aria-label="Back to NURU" className="flex items-center gap-1 text-sm font-medium">
        <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 2 3 6l4.5 4" />
        </svg>
        NURU
      </Link>
      <span className="text-sm font-semibold">{title}</span>
      <div className="flex w-10 justify-end">{rightSlot}</div>
    </header>
  );
}
