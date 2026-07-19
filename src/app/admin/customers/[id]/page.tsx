import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { updateCustomer } from "@/lib/customer-actions";

export const metadata: Metadata = { title: "Customer" };

const inputClass =
  "w-full rounded-control border border-border-subtle px-3 py-2 text-sm outline-none focus:border-foreground";
const primaryButtonClass =
  "rounded-control bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-KE", { dateStyle: "medium" }).format(date);
}

export default async function AdminCustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminSession();
  const { id } = await params;

  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      orders: {
        orderBy: { createdAt: "desc" },
        include: { invoice: true, estimates: true, deliveryNote: true },
      },
    },
  });

  if (!customer) notFound();

  return (
    <div>
      <h2 className="text-lg font-medium">{customer.name ?? customer.email}</h2>

      <details className="mt-6" open>
        <summary className="cursor-pointer text-sm font-medium">Contact details</summary>
        <form action={updateCustomer.bind(null, customer.id)} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs text-neutral-500">Name</label>
            <input type="text" name="name" defaultValue={customer.name ?? ""} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs text-neutral-500">Email</label>
            <input type="email" name="email" required defaultValue={customer.email} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs text-neutral-500">Phone</label>
            <input type="text" name="phone" defaultValue={customer.phone ?? ""} className={inputClass} />
          </div>
          <div className="flex items-end sm:col-span-2">
            <button type="submit" className={`${primaryButtonClass} w-full sm:w-auto`}>
              Save
            </button>
          </div>
        </form>
      </details>

      <div className="mt-8">
        <h3 className="text-sm font-medium text-neutral-500">Orders &amp; documents</h3>
        <ul className="mt-3 space-y-3">
          {customer.orders.map((order) => (
            <li key={order.id} className="rounded-card border border-border-subtle p-4 text-sm">
              <Link
                href={`/admin/orders/${order.id}`}
                className="flex flex-wrap items-center justify-between gap-3 hover:opacity-80"
              >
                <span className="block text-neutral-500">{formatDate(order.createdAt)}</span>
                <span className="text-right text-neutral-500">
                  {order.estimates.length > 0 && <span className="block">{order.estimates.length} estimate(s)</span>}
                  {order.invoice && <span className="block">Invoice {order.invoice.status}</span>}
                  {order.deliveryNote && <span className="block">Delivery {order.deliveryNote.status}</span>}
                  {!order.invoice && order.estimates.length === 0 && !order.deliveryNote && "No documents yet"}
                </span>
              </Link>
            </li>
          ))}
          {customer.orders.length === 0 && <p className="text-sm text-neutral-500">No orders yet.</p>}
        </ul>
      </div>
    </div>
  );
}
