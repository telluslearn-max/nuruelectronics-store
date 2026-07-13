"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "./prisma";
import { requireAdminSession } from "./admin-auth";
import { postJournalEntry } from "./ledger";

function parseJournalLines(formData: FormData): { accountCode: string; debit?: number; credit?: number }[] {
  const lines: { accountCode: string; debit?: number; credit?: number }[] = [];
  for (let i = 0; i < 10; i++) {
    const accountCode = formData.get(`line_account_${i}`);
    const debit = Number(formData.get(`line_debit_${i}`)) || 0;
    const credit = Number(formData.get(`line_credit_${i}`)) || 0;
    if (!accountCode || (debit === 0 && credit === 0)) continue;
    lines.push({ accountCode: String(accountCode), debit, credit });
  }
  return lines;
}

export async function createManualJournalEntry(formData: FormData): Promise<void> {
  await requireAdminSession();

  const date = new Date(String(formData.get("date") ?? ""));
  const description = String(formData.get("description") ?? "").trim();
  const lines = parseJournalLines(formData);

  if (!description || lines.length === 0) {
    throw new Error("A description and at least one balanced pair of lines are required.");
  }

  await prisma.$transaction(async (tx) => {
    await postJournalEntry(tx, { date, description, sourceType: "manual", lines });
  });

  revalidatePath("/admin/journal");
}
