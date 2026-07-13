import type { Metadata } from "next";
import Link from "next/link";
import { requireAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Delivery Notes" };

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-KE", { dateStyle: "medium" }).format(date);
}

export default async function AdminDeliveryNotesPage() {
  await requireAdminSession();

  const notes = await prisma.deliveryNote.findMany({
    orderBy: { createdAt: "desc" },
    include: { order: { include: { customer: true } } },
  });

  return (
    <div>
      <h2 className="text-lg font-medium">Delivery Notes</h2>
      <ul className="mt-6 space-y-3">
        {notes.map((note) => (
          <li key={note.id} className="rounded-card border border-border-subtle p-4 text-sm">
            <Link href={`/admin/orders/${note.orderId}`} className="flex flex-wrap items-center justify-between gap-2 hover:underline">
              <span>
                {note.number} · {note.order.customer.name ?? note.order.customer.email} · {note.recipientName}
              </span>
              <span className="text-neutral-500">
                {note.status} · {formatDate(note.createdAt)}
              </span>
            </Link>
          </li>
        ))}
        {notes.length === 0 && <p className="text-sm text-neutral-500">No delivery notes yet.</p>}
      </ul>
    </div>
  );
}
