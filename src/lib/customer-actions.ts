"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "./prisma";
import { requireAdminSession } from "./admin-auth";

export async function updateCustomer(customerId: string, formData: FormData): Promise<void> {
  await requireAdminSession();

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;

  if (!email) {
    throw new Error("Email is required.");
  }

  const existing = await prisma.customer.findUnique({ where: { email } });
  if (existing && existing.id !== customerId) {
    throw new Error("Another customer already uses that email.");
  }

  await prisma.customer.update({
    where: { id: customerId },
    data: { email, name, phone },
  });

  revalidatePath("/admin/customers");
  revalidatePath(`/admin/customers/${customerId}`);
}
