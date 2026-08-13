import type { Metadata } from "next";
import { submitFeedback } from "@/lib/feedback-actions";
import { verifyFeedbackToken } from "@/lib/feedback-token";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Feedback", robots: { index: false, follow: false } };

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-KE", { dateStyle: "medium" }).format(date);
}

export default async function FeedbackPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const { token } = await params;
  const { success, error } = await searchParams;
  const payload = verifyFeedbackToken(token);

  if (!payload) {
    return (
      <div className="mx-auto max-w-md px-6 py-24 text-center">
        <h1 className="text-title">This link has expired</h1>
        <p className="mt-3 text-neutral-500">
          Feedback links are only valid for a couple of weeks. Thanks for shopping with us either way!
        </p>
      </div>
    );
  }

  const order = payload
    ? await prisma.order.findUnique({ where: { id: payload.orderId } })
    : null;

  if (!order || order.customerId !== payload.customerId) {
    return (
      <div className="mx-auto max-w-md px-6 py-24 text-center">
        <h1 className="text-title">We couldn&apos;t find that order</h1>
        <p className="mt-3 text-neutral-500">This feedback link doesn&apos;t match an order on file.</p>
      </div>
    );
  }

  if (success) {
    return (
      <div className="mx-auto max-w-md px-6 py-24 text-center">
        <h1 className="text-title">Thanks for the feedback!</h1>
        <p className="mt-3 text-neutral-500">We really appreciate you taking the time.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-6 py-16">
      <h1 className="text-title">How was your order?</h1>
      <p className="mt-2 text-neutral-500">
        {order.shopifyOrderName ?? `Order ${order.id.slice(0, 8)}`} · {formatDate(order.createdAt)}
      </p>

      {error && (
        <p role="alert" className="mt-4 rounded-card border border-border-subtle bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
          Please pick a rating from 1 to 5.
        </p>
      )}

      <form action={submitFeedback.bind(null, token)} className="mt-8 space-y-6">
        <div>
          <label className="block text-sm font-medium">Rating</label>
          <div className="mt-3 flex gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <label
                key={n}
                className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-control border border-border-subtle text-sm transition has-[:checked]:border-foreground has-[:checked]:bg-foreground has-[:checked]:text-background"
              >
                <input type="radio" name="rating" value={n} required className="sr-only" />
                {n}
              </label>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium">Comments (optional)</label>
          <textarea
            name="comment"
            rows={4}
            className="mt-2 w-full rounded-control border border-border-subtle px-3 py-2 text-sm outline-none focus:border-foreground"
          />
        </div>
        <button
          type="submit"
          className="w-full rounded-control bg-foreground px-6 py-3 text-sm font-medium text-background transition hover:opacity-90"
        >
          Submit feedback
        </button>
      </form>
    </div>
  );
}
