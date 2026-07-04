import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <p className="text-sm font-medium text-accent">404</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Page not found</h1>
      <p className="mt-2 max-w-sm text-neutral-500">
        We couldn&apos;t find the page you&apos;re looking for. It may have been moved or no
        longer exists.
      </p>
      <Link
        href="/"
        className="mt-8 rounded-control bg-foreground px-6 py-3 text-sm font-medium text-background transition hover:opacity-90"
      >
        Back to shop
      </Link>
    </div>
  );
}
