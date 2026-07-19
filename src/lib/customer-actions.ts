"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "./prisma";
import { requireAdminSession } from "./admin-auth";
import { redirectWithError, redirectWithSuccess } from "./admin-feedback";

export async function updateCustomer(customerId: string, formData: FormData): Promise<void> {
  await requireAdminSession();

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;

  if (!email) {
    redirectWithError(`/admin/customers/${customerId}`, "Email is required.");
  }

  const existing = await prisma.customer.findUnique({ where: { email } });
  if (existing && existing.id !== customerId) {
    redirectWithError(`/admin/customers/${customerId}`, "Another customer already uses that email.");
  }

  await prisma.customer.update({
    where: { id: customerId },
    data: { email, name, phone },
  });

  revalidatePath("/admin/customers");
  revalidatePath(`/admin/customers/${customerId}`);
  redirectWithSuccess(`/admin/customers/${customerId}`, "Customer updated.");
}
