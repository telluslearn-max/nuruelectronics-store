import Link from "next/link";
import { formatPrice } from "@/lib/format";
import type { Customer, OrderItem } from "@prisma/client";

export const inputClass =
  "w-full rounded-control border border-border-subtle px-3 py-2 text-sm outline-none focus:border-foreground";
export const primaryButtonClass =
  "rounded-control bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90";
export const secondaryButtonClass =
  "rounded-control border border-border-subtle px-4 py-2 text-sm font-medium transition hover:border-foreground";
export const cardClass = "rounded-card border border-border-subtle p-4";
export const cardLabelClass = "text-xs font-medium uppercase tracking-wide text-neutral-500";

export function formatDate(date: Date | null) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-KE", { dateStyle: "medium" }).format(date);
}

export function toDateInputValue(date: Date | null): string {
  if (!date) return "";
  return date.toISOString().slice(0, 10);
}

export function BillToCard({ customer }: { customer: Customer }) {
  return (
    <div className={cardClass}>
      <p className={cardLabelClass}>Bill to</p>
      <p className="mt-2 text-sm font-medium">{customer.name ?? customer.email}</p>
      {customer.name && <p className="mt-0.5 text-sm text-neutral-500">{customer.email}</p>}
      {customer.phone && <p className="mt-0.5 text-sm text-neutral-500">{customer.phone}</p>}
    </div>
  );
}

export function ItemsCard({ items, currencyCode }: { items: OrderItem[]; currencyCode: string }) {
  return (
    <div className={cardClass}>
      <p className={cardLabelClass}>Items</p>
      <ul className="mt-3 space-y-2 text-sm">
        {items.map((item) => (
          <li key={item.id} className="flex justify-between">
            <span>
              {item.title} × {item.quantity}
            </span>
            <span>{formatPrice(item.lineTotal.toString(), currencyCode)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BackChevronIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

/** Back-chevron + title header for a dedicated full-screen create flow. */
export function ScreenHeader({ backHref, title }: { backHref: string; title: string }) {
  return (
    <div className="mb-6 flex items-center gap-3">
      <Link
        href={backHref}
        aria-label="Back"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border-subtle text-neutral-500 transition hover:border-foreground hover:text-foreground"
      >
        <BackChevronIcon />
      </Link>
      <h2 className="text-lg font-medium">{title}</h2>
    </div>
  );
}
