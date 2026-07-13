"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "./prisma";
import { requireAdminSession } from "./admin-auth";
import { ACCOUNTS, cashAccountForMethod, postJournalEntry } from "./ledger";
import { getAccumulatedDepreciation, postMonthlyDepreciation } from "./depreciation";
import type { PaymentMethod } from "@prisma/client";

export async function createFixedAsset(formData: FormData): Promise<void> {
  await requireAdminSession();

  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const purchaseDate = new Date(String(formData.get("purchaseDate") ?? ""));
  const purchaseCost = Number(formData.get("purchaseCost") ?? 0) || 0;
  const salvageValue = Number(formData.get("salvageValue") ?? 0) || 0;
  const usefulLifeYears = Number(formData.get("usefulLifeYears") ?? 0) || 0;
  const paidFrom = String(formData.get("paidFrom")) as PaymentMethod;

  if (!name || purchaseCost <= 0 || usefulLifeYears <= 0) {
    throw new Error("A name, positive purchase cost, and useful life are required.");
  }

  await prisma.$transaction(async (tx) => {
    const asset = await tx.fixedAsset.create({
      data: { name, category, purchaseDate, purchaseCost: purchaseCost.toFixed(2), salvageValue: salvageValue.toFixed(2), usefulLifeYears },
    });
    await postJournalEntry(tx, {
      date: purchaseDate,
      description: `Fixed asset purchased: ${asset.name}`,
      sourceType: "fixed_asset",
      sourceId: asset.id,
      lines: [
        { accountCode: ACCOUNTS.FIXED_ASSETS, debit: purchaseCost },
        { accountCode: cashAccountForMethod(paidFrom), credit: purchaseCost },
      ],
    });
  });

  revalidatePath("/admin/assets");
}

export async function disposeFixedAsset(assetId: string, formData: FormData): Promise<void> {
  await requireAdminSession();

  const disposalValue = Number(formData.get("disposalValue") ?? 0) || 0;
  const asset = await prisma.fixedAsset.findUniqueOrThrow({ where: { id: assetId } });
  const accumulated = await getAccumulatedDepreciation(assetId);
  const cost = Number(asset.purchaseCost);
  // Plug balances the entry: positive = loss on disposal (an expense), negative = gain (reduces expenses).
  const plug = cost - accumulated - disposalValue;

  await prisma.$transaction(async (tx) => {
    await tx.fixedAsset.update({
      where: { id: assetId },
      data: { disposedAt: new Date(), disposalValue: disposalValue.toFixed(2) },
    });

    const lines: { accountCode: string; debit?: number; credit?: number }[] = [
      { accountCode: ACCOUNTS.ACCUMULATED_DEPRECIATION, debit: accumulated },
      { accountCode: ACCOUNTS.FIXED_ASSETS, credit: cost },
    ];
    if (disposalValue > 0) lines.push({ accountCode: ACCOUNTS.CASH, debit: disposalValue });
    if (plug > 0) lines.push({ accountCode: ACCOUNTS.OTHER_OPERATING_EXPENSES, debit: plug });
    if (plug < 0) lines.push({ accountCode: ACCOUNTS.OTHER_OPERATING_EXPENSES, credit: -plug });

    await postJournalEntry(tx, {
      date: new Date(),
      description: `Fixed asset disposed: ${asset.name}`,
      sourceType: "fixed_asset_disposal",
      sourceId: asset.id,
      lines,
    });
  });

  revalidatePath("/admin/assets");
}

export async function runMonthlyDepreciation(): Promise<void> {
  await requireAdminSession();
  await postMonthlyDepreciation();
  revalidatePath("/admin/assets");
  revalidatePath("/admin/reports/fixed-assets");
}
