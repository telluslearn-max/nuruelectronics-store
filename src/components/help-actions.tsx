import Link from "next/link";

const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER;

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 12a8 8 0 1 1 3.5 6.6L4 20l1.4-3.5A7.96 7.96 0 0 1 4 12z" />
    </svg>
  );
}

function PackageIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3.5 8.5 12 4l8.5 4.5v7L12 20l-8.5-4.5v-7z" />
      <path d="M3.5 8.5 12 13l8.5-4.5M12 13v7" />
    </svg>
  );
}

function TruckIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="8" width="12" height="8" rx="1" />
      <path d="M14 11h4l3 3v2h-7" />
      <circle cx="7" cy="18" r="1.6" />
      <circle cx="17" cy="18" r="1.6" />
    </svg>
  );
}

/** The three real self-service actions this site actually supports. */
export function HelpActions({ deliveryHref = "#delivery" }: { deliveryHref?: string }) {
  const whatsappHref = WHATSAPP_NUMBER
    ? `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent("Hi! I'd like some help finding a product on NURU.")}`
    : null;

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {whatsappHref && (
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex flex-col items-start gap-3 rounded-card border border-border-subtle bg-background p-6 transition hover:border-foreground"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent/10 text-accent">
            <ChatIcon />
          </span>
          <div>
            <h3 className="font-semibold">Chat with us</h3>
            <p className="mt-1 text-sm text-neutral-500">
              Message us on WhatsApp for advice before you buy.
            </p>
          </div>
          <span className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-accent">
            Start chat
            <span aria-hidden="true" className="transition group-hover:translate-x-0.5">&rarr;</span>
          </span>
        </a>
      )}
      <Link
        href="/account"
        className="group flex flex-col items-start gap-3 rounded-card border border-border-subtle bg-background p-6 transition hover:border-foreground"
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent/10 text-accent">
          <PackageIcon />
        </span>
        <div>
          <h3 className="font-semibold">Track your order</h3>
          <p className="mt-1 text-sm text-neutral-500">Check the status of a recent order.</p>
        </div>
        <span className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-accent">
          View account
          <span aria-hidden="true" className="transition group-hover:translate-x-0.5">&rarr;</span>
        </span>
      </Link>
      <Link
        href={deliveryHref}
        className="group flex flex-col items-start gap-3 rounded-card border border-border-subtle bg-background p-6 transition hover:border-foreground"
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent/10 text-accent">
          <TruckIcon />
        </span>
        <div>
          <h3 className="font-semibold">Delivery & warranty</h3>
          <p className="mt-1 text-sm text-neutral-500">
            How every order ships and what&apos;s covered.
          </p>
        </div>
        <span className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-accent">
          Read more
          <span aria-hidden="true" className="transition group-hover:translate-x-0.5">&rarr;</span>
        </span>
      </Link>
    </div>
  );
}
