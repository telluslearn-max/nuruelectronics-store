"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "./prisma";
import { requireAdminSession } from "./admin-auth";
import { ACCOUNTS, postJournalEntry } from "./ledger";
import { redirectWithError, redirectWithSuccess } from "./admin-feedback";
import { logAdminAction } from "./audit-log";

export async function createPettyCashFund(formData: FormData): Promise<void> {
  await requireAdminSession();

  const name = String(formData.get("name") ?? "Shop Petty Cash").trim() || "Shop Petty Cash";
  const floatAmount = Number(formData.get("floatAmount") ?? 0) || 0;
  if (floatAmount <= 0) redirectWithError("/admin/petty-cash", "Float amount must be greater than zero.");

  const existing = await prisma.pettyCashFund.findFirst();
  if (existing) redirectWithError("/admin/petty-cash", "A petty cash fund already exists.");

  await prisma.$transaction(async (tx) => {
    const fund = await tx.pettyCashFund.create({ data: { name, floatAmount: floatAmount.toFixed(2) } });
    await tx.pettyCashEntry.create({
      data: {
        fundId: fund.id,
        type: "replenishment",
        amount: floatAmount.toFixed(2),
        description: "Initial float",
        date: new Date(),
      },
    });
    await postJournalEntry(tx, {
      date: new Date(),
      description: `Petty cash fund "${fund.name}" established`,
      sourceType: "petty_cash_fund",
      sourceId: fund.id,
      lines: [
        { accountCode: ACCOUNTS.PETTY_CASH, debit: floatAmount },
        { accountCode: ACCOUNTS.CASH, credit: floatAmount },
      ],
    });

    await logAdminAction(
      {
        action: "pettyCash.createFund",
        entityType: "pettyCashFund",
        entityId: fund.id,
        summary: `Created petty cash fund "${fund.name}" with float ${floatAmount.toFixed(2)}`,
        metadata: { name: fund.name, floatAmount },
      },
      tx,
    );
  });

  revalidatePath("/admin/petty-cash");
  redirectWithSuccess("/admin/petty-cash", "Petty cash fund created.");
}

export async function replenishPettyCash(fundId: string, formData: FormData): Promise<void> {
  await requireAdminSession();

  const amount = Number(formData.get("amount") ?? 0) || 0;
  if (amount <= 0) redirectWithError("/admin/petty-cash", "Replenishment amount must be greater than zero.");

  await prisma.$transaction(async (tx) => {
    const entry = await tx.pettyCashEntry.create({
      data: { fundId, type: "replenishment", amount: amount.toFixed(2), description: "Float replenishment", date: new Date() },
    });
    await postJournalEntry(tx, {
      date: new Date(),
      description: "Petty cash float replenishment",
      sourceType: "petty_cash_entry",
      sourceId: entry.id,
      lines: [
        { accountCode: ACCOUNTS.PETTY_CASH, debit: amount },
        { accountCode: ACCOUNTS.CASH, credit: amount },
      ],
    });

    await logAdminAction(
      {
        action: "pettyCash.replenish",
        entityType: "pettyCashFund",
        entityId: fundId,
        summary: `Replenished petty cash fund by ${amount.toFixed(2)}`,
        metadata: { fundId, amount },
      },
      tx,
    );
  });

  revalidatePath("/admin/petty-cash");
  redirectWithSuccess("/admin/petty-cash", "Petty cash replenished.");
}
