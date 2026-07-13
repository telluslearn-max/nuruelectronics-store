import type { Metadata } from "next";
import { requireAdminSession } from "@/lib/admin-auth";
import { createManualOrder } from "@/lib/admin-actions";

export const metadata: Metadata = {
  title: "New manual order",
};

const LINE_ITEM_ROWS = 8;

export default async function NewManualOrderPage() {
  await requireAdminSession();

  return (
    <div>
      <h2 className="text-lg font-medium">New manual order</h2>
      <p className="mt-2 text-neutral-500">For WhatsApp or other off-platform sales.</p>

      <form action={createManualOrder} className="mt-8 max-w-2xl space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label htmlFor="email" className="block text-sm font-medium">
              Customer email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="mt-1 w-full rounded-control border border-border-subtle px-3 py-2 text-sm outline-none focus:border-foreground"
            />
          </div>
          <div>
            <label htmlFor="phone" className="block text-sm font-medium">
              Phone
            </label>
            <input
              id="phone"
              name="phone"
              type="text"
              className="mt-1 w-full rounded-control border border-border-subtle px-3 py-2 text-sm outline-none focus:border-foreground"
            />
          </div>
          <div className="sm:col-span-3">
            <label htmlFor="name" className="block text-sm font-medium">
              Customer name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              className="mt-1 w-full rounded-control border border-border-subtle px-3 py-2 text-sm outline-none focus:border-foreground"
            />
          </div>
        </div>

        <div>
          <p className="text-sm font-medium">Line items</p>
          <div className="mt-2 space-y-2">
            <div className="grid grid-cols-12 gap-2 text-xs text-neutral-500">
              <span className="col-span-7">Title</span>
              <span className="col-span-2">Qty</span>
              <span className="col-span-3">Unit price (KES)</span>
            </div>
            {Array.from({ length: LINE_ITEM_ROWS }).map((_, i) => (
              <div key={i} className="grid grid-cols-12 gap-2">
                <input
                  name={`item_title_${i}`}
                  type="text"
                  placeholder="Product / description"
                  className="col-span-7 rounded-control border border-border-subtle px-3 py-2 text-sm outline-none focus:border-foreground"
                />
                <input
                  name={`item_qty_${i}`}
                  type="number"
                  min={0}
                  step={1}
                  defaultValue={i === 0 ? 1 : undefined}
                  className="col-span-2 rounded-control border border-border-subtle px-3 py-2 text-sm outline-none focus:border-foreground"
                />
                <input
                  name={`item_price_${i}`}
                  type="number"
                  min={0}
                  step="0.01"
                  className="col-span-3 rounded-control border border-border-subtle px-3 py-2 text-sm outline-none focus:border-foreground"
                />
              </div>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="note" className="block text-sm font-medium">
            Note (optional)
          </label>
          <textarea
            id="note"
            name="note"
            rows={2}
            className="mt-1 w-full rounded-control border border-border-subtle px-3 py-2 text-sm outline-none focus:border-foreground"
          />
        </div>

        <button
          type="submit"
          className="rounded-control bg-foreground px-6 py-3 text-sm font-medium text-background transition hover:opacity-90"
        >
          Create order
        </button>
      </form>
    </div>
  );
}
