import type { Metadata } from "next";
import { requireAdminSession } from "@/lib/admin-auth";

export const metadata: Metadata = {
  title: "Orders",
};

export default async function AdminOrdersPage() {
  await requireAdminSession();

  return (
    <div>
      <h2 className="text-lg font-medium">Orders</h2>
      <p className="mt-3 text-neutral-500">Order hub coming up next.</p>
    </div>
  );
}
