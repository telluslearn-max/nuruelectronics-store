type StatusCategory = "neutral" | "info" | "success" | "warning" | "danger";

const STATUS_META: Record<string, { className: string; category: StatusCategory }> = {
  draft: { className: "bg-neutral-100 text-neutral-600", category: "neutral" },
  pending: { className: "bg-neutral-100 text-neutral-600", category: "neutral" },
  sent: { className: "bg-blue-100 text-blue-700", category: "info" },
  accepted: { className: "bg-green-100 text-green-700", category: "success" },
  paid: { className: "bg-green-100 text-green-700", category: "success" },
  delivered: { className: "bg-green-100 text-green-700", category: "success" },
  partially_paid: { className: "bg-amber-100 text-amber-700", category: "warning" },
  declined: { className: "bg-red-100 text-red-700", category: "danger" },
  void: { className: "bg-red-100 text-red-700", category: "danger" },
  expired: { className: "bg-neutral-100 text-neutral-500", category: "neutral" },
  // Return/refund case statuses (see /admin/support).
  approved: { className: "bg-green-100 text-green-700", category: "success" },
  refunded: { className: "bg-blue-100 text-blue-700", category: "info" },
  escalated: { className: "bg-amber-100 text-amber-700", category: "warning" },
  denied: { className: "bg-red-100 text-red-700", category: "danger" },
  // Shopify order fulfillment statuses (customer-facing account/order-history pages).
  fulfilled: { className: "bg-green-100 text-green-700", category: "success" },
  unfulfilled: { className: "bg-neutral-100 text-neutral-600", category: "neutral" },
  partially_fulfilled: { className: "bg-amber-100 text-amber-700", category: "warning" },
  restocked: { className: "bg-red-100 text-red-700", category: "danger" },
  scheduled: { className: "bg-blue-100 text-blue-700", category: "info" },
};

const DEFAULT_META = { className: "bg-neutral-100 text-neutral-600", category: "neutral" as const };

function formatStatusLabel(status: string): string {
  return status.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

// A same-shaped icon per category, alongside color — so status isn't conveyed by color alone
// (fails for colorblind users, and a screenshot/greyscale print loses it entirely).
function CategoryIcon({ category }: { category: StatusCategory }) {
  const paths: Record<StatusCategory, React.ReactNode> = {
    neutral: <circle cx="6" cy="6" r="3" fill="currentColor" stroke="none" />,
    info: (
      <>
        <circle cx="6" cy="6" r="4.5" />
        <path d="M6 5v3.2M6 3.6h.01" />
      </>
    ),
    success: <path d="M2.5 6.2 4.8 8.5 9.5 3.5" />,
    warning: (
      <>
        <path d="M6 2.5 10.2 9.5H1.8L6 2.5Z" />
        <path d="M6 5.3v2M6 8.6h.01" />
      </>
    ),
    danger: <path d="M3 3l6 6M9 3l-6 6" />,
  };
  return (
    <svg
      viewBox="0 0 12 12"
      className="h-2.5 w-2.5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[category]}
    </svg>
  );
}

export function StatusPill({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? DEFAULT_META;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-control px-2.5 py-0.5 text-xs font-medium ${meta.className}`}
    >
      <CategoryIcon category={meta.category} />
      {formatStatusLabel(status)}
    </span>
  );
}
