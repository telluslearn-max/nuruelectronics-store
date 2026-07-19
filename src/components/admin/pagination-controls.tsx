import Link from "next/link";
import { buildPageHref, type PageSearchParams } from "@/lib/pagination";

export function PaginationControls({
  pathname,
  searchParams,
  page,
  pageSize,
  totalCount,
}: {
  pathname: string;
  searchParams: PageSearchParams;
  page: number;
  pageSize: number;
  totalCount: number;
}) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  if (totalPages <= 1) return null;

  const buttonClass =
    "rounded-control border border-border-subtle px-4 py-2 text-sm font-medium transition hover:border-foreground";
  const disabledClass = "rounded-control border border-transparent px-4 py-2 text-sm font-medium text-neutral-300";

  return (
    <div className="mt-6 flex items-center justify-between gap-3">
      {page > 1 ? (
        <Link href={buildPageHref(pathname, searchParams, page - 1)} className={buttonClass}>
          Previous
        </Link>
      ) : (
        <span className={disabledClass}>Previous</span>
      )}
      <span className="text-sm text-neutral-500">
        Page {page} of {totalPages}
      </span>
      {page < totalPages ? (
        <Link href={buildPageHref(pathname, searchParams, page + 1)} className={buttonClass}>
          Next
        </Link>
      ) : (
        <span className={disabledClass}>Next</span>
      )}
    </div>
  );
}
