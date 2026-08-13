import type { Metadata } from "next";
import { requireAdminSession } from "@/lib/admin-auth";
import { createManualOrder } from "@/lib/admin-actions";
import { FeedbackBanner } from "@/components/admin/feedback-banner";
import { SubmitButton } from "@/components/admin/submit-button";
import { inputClass, primaryButtonClass } from "../[id]/_shared";
import { LineItemsGrid } from "./line-items-grid";

export const metadata: Metadata = {
  title: "New manual order",
};

export default async function NewManualOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireAdminSession();
  const { error } = await searchParams;

  return (
    <div>
      <h2 className="text-lg font-medium">New manual order</h2>
      <p className="mt-2 text-neutral-500">For WhatsApp or other off-platform sales.</p>
      <FeedbackBanner error={error} />

      <form action={createManualOrder} className="mt-8 max-w-2xl space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label htmlFor="email" className="block text-sm font-medium">
              Customer email
            </label>
            <input id="email" name="email" type="email" required className={`mt-1 ${inputClass}`} />
          </div>
          <div>
            <label htmlFor="phone" className="block text-sm font-medium">
              Phone
            </label>
            <input id="phone" name="phone" type="text" className={`mt-1 ${inputClass}`} />
          </div>
          <div className="sm:col-span-3">
            <label htmlFor="name" className="block text-sm font-medium">
              Customer name
            </label>
            <input id="name" name="name" type="text" className={`mt-1 ${inputClass}`} />
          </div>
        </div>

        <div>
          <p className="text-sm font-medium">Line items</p>
          <p className="mt-1 text-xs text-neutral-500">
            Search for a product to fill in its price and Shopify Variant ID automatically, or type your own
            description for items not in the catalog. The Variant ID only matters if you check the box below to
            also deduct this sale from Shopify&apos;s own stock count.
          </p>
          <LineItemsGrid />
        </div>

        <div className="flex items-center gap-2">
          <input id="deductInventory" name="deductInventory" type="checkbox" className="h-4 w-4" />
          <label htmlFor="deductInventory" className="text-sm">
            Deduct from Shopify inventory for line items with a Variant ID
          </label>
        </div>

        <div>
          <label htmlFor="note" className="block text-sm font-medium">
            Note (optional)
          </label>
          <textarea id="note" name="note" rows={2} className={`mt-1 ${inputClass}`} />
        </div>

        <SubmitButton className={primaryButtonClass} pendingText="Creating…">
          Create order
        </SubmitButton>
      </form>
    </div>
  );
}
