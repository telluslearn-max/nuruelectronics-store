import "server-only";
import type { DocumentType, Settings } from "@prisma/client";
import { prisma } from "./prisma";

const SETTINGS_ID = "settings";

export async function getSettings(): Promise<Settings> {
  const existing = await prisma.settings.findUnique({ where: { id: SETTINGS_ID } });
  if (existing) return existing;
  return prisma.settings.create({ data: { id: SETTINGS_ID } });
}

const PREFIX_FIELD_BY_TYPE: Record<DocumentType, keyof Settings> = {
  estimate: "documentNumberPrefixEstimate",
  invoice: "documentNumberPrefixInvoice",
  receipt: "documentNumberPrefixReceipt",
  delivery_note: "documentNumberPrefixDeliveryNote",
  bill: "documentNumberPrefixBill",
  payslip: "documentNumberPrefixPayslip",
};

export function documentNumberPrefixOverride(settings: Settings, type: DocumentType): string | null {
  const value = settings[PREFIX_FIELD_BY_TYPE[type]];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
