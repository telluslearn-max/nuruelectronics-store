const STATUS_STYLES: Record<string, string> = {
  draft: "bg-neutral-100 text-neutral-600",
  pending: "bg-neutral-100 text-neutral-600",
  sent: "bg-blue-100 text-blue-700",
  accepted: "bg-green-100 text-green-700",
  paid: "bg-green-100 text-green-700",
  delivered: "bg-green-100 text-green-700",
  partially_paid: "bg-amber-100 text-amber-700",
  declined: "bg-red-100 text-red-700",
  void: "bg-red-100 text-red-700",
  expired: "bg-neutral-100 text-neutral-500",
};

function formatStatusLabel(status: string): string {
  return status.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

export function StatusPill({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? "bg-neutral-100 text-neutral-600";
  return (
    <span className={`inline-flex items-center rounded-control px-2.5 py-0.5 text-xs font-medium ${style}`}>
      {formatStatusLabel(status)}
    </span>
  );
}
