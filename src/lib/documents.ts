import "server-only";
import { randomBytes } from "node:crypto";
import type { DocumentType, Prisma } from "@prisma/client";

const PREFIXES: Record<DocumentType, string> = {
  estimate: "EST",
  invoice: "INV",
  receipt: "RCT",
  delivery_note: "DN",
  bill: "BILL",
  payslip: "PAY",
};

/**
 * Mints the next sequential document number for `type` in the current year,
 * e.g. INV-2026-0001. Must be called inside the same transaction that creates
 * the document row, so the increment and the insert commit atomically.
 */
export async function mintDocumentNumber(tx: Prisma.TransactionClient, type: DocumentType): Promise<string> {
  const year = new Date().getFullYear();
  const sequence = await tx.documentSequence.upsert({
    where: { type_year: { type, year } },
    create: { type, year, value: 1 },
    update: { value: { increment: 1 } },
  });
  return `${PREFIXES[type]}-${year}-${String(sequence.value).padStart(4, "0")}`;
}

export function generateAccessToken(): string {
  return randomBytes(24).toString("base64url");
}
