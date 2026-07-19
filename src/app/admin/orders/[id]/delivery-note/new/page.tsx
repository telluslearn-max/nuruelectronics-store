import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/admin-auth";
import { createDeliveryNote } from "@/lib/admin-actions";
import { ScreenHeader, cardClass, cardLabelClass, inputClass, primaryButtonClass } from "../../_shared";
import { FeedbackBanner } from "@/components/admin/feedback-banner";

export const metadata: Metadata = {
  title: "Create delivery note",
};

export default async function NewDeliveryNotePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  await requireAdminSession();
  const { id } = await params;
  const { error } = await searchParams;

  const order = await prisma.order.findUnique({
    where: { id },
    include: { deliveryNote: true },
  });

  if (!order) notFound();
  if (order.deliveryNote) notFound();

  return (
    <div>
      <ScreenHeader backHref={`/admin/orders/${order.id}`} title="Create delivery note" />
      <FeedbackBanner error={error} />
      <form action={createDeliveryNote.bind(null, order.id)} className="space-y-4">
        <div className={cardClass}>
          <p className={cardLabelClass}>Recipient</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs text-neutral-500">Recipient name</label>
              <input type="text" name="recipientName" required className={inputClass} />
            </div>
            <div>
              <label className="block text-xs text-neutral-500">Recipient phone</label>
              <input type="text" name="recipientPhone" className={inputClass} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-neutral-500">Delivery address</label>
              <input type="text" name="deliveryAddress" required className={inputClass} />
            </div>
            <div>
              <label className="block text-xs text-neutral-500">Method</label>
              <input type="text" name="deliveryMethod" placeholder="Rider, courier, pickup…" className={inputClass} />
            </div>
          </div>
        </div>
        <button type="submit" className={`${primaryButtonClass} w-full sm:w-auto`}>
          Create delivery note
        </button>
      </form>
    </div>
  );
}
