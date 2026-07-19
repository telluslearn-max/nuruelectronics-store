"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "./prisma";
import { requireAdminSession } from "./admin-auth";

const SETTINGS_ID = "settings";

function optionalTrimmed(formData: FormData, key: string): string | null {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

export async function updateSettings(formData: FormData): Promise<void> {
  await requireAdminSession();

  const companyName = String(formData.get("companyName") ?? "").trim() || "NURU Electronics";
  const currencyCode = String(formData.get("currencyCode") ?? "").trim() || "KES";
  const defaultTaxRatePercent = Number(formData.get("defaultTaxRatePercent") ?? 0) || 0;

  const data = {
    companyName,
    companyEmail: optionalTrimmed(formData, "companyEmail"),
    companyPhone: optionalTrimmed(formData, "companyPhone"),
    companyAddress: optionalTrimmed(formData, "companyAddress"),
    logoUrl: optionalTrimmed(formData, "logoUrl"),
    defaultTaxRatePercent: defaultTaxRatePercent.toFixed(2),
    currencyCode,
    documentNumberPrefixEstimate: optionalTrimmed(formData, "documentNumberPrefixEstimate"),
    documentNumberPrefixInvoice: optionalTrimmed(formData, "documentNumberPrefixInvoice"),
    documentNumberPrefixReceipt: optionalTrimmed(formData, "documentNumberPrefixReceipt"),
    documentNumberPrefixDeliveryNote: optionalTrimmed(formData, "documentNumberPrefixDeliveryNote"),
    documentNumberPrefixBill: optionalTrimmed(formData, "documentNumberPrefixBill"),
    documentNumberPrefixPayslip: optionalTrimmed(formData, "documentNumberPrefixPayslip"),
  };

  await prisma.settings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID, ...data },
    update: data,
  });

  revalidatePath("/admin/settings");
}
