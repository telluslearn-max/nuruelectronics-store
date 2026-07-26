import { DELIVERY_FACTS } from "@/lib/delivery-facts";

export function ProductDeliveryCard() {
  return (
    <div className="rounded-card border border-border-subtle p-4">
      <div className="space-y-4">
        {DELIVERY_FACTS.map((fact) => (
          <div key={fact.title} className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-50 text-accent">
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                {fact.icon}
              </svg>
            </span>
            <div>
              <p className="text-sm font-medium">{fact.title}</p>
              <p className="text-sm text-neutral-500">{fact.body}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
