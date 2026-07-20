export function ConciergeCheckoutCta({ url }: { url: string }) {
  return (
    <a
      href={url}
      className="mt-2 flex w-full items-center justify-center gap-2 rounded-control bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground transition hover:opacity-90"
    >
      Proceed to checkout
    </a>
  );
}
