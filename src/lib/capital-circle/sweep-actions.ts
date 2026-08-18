"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "../prisma";
import { requireAdminSession } from "../admin-auth";
import { logAdminAction } from "../audit-log";
import { redirectWithError, redirectWithSuccess } from "../admin-feedback";

/**
 * The only write path this feature has: a human, after manually converting
 * USD to USDC (via Circle Mint or an exchange) and sending it to the wallet,
 * records what actually arrived. No code path here — or anywhere in Capital
 * Circle's sweep flow — calls a payment or exchange API.
 */
export async function confirmSweep(sweepId: string, formData: FormData): Promise<void> {
  await requireAdminSession();

  const confirmedUsdcAmount = Number(formData.get("confirmedUsdcAmount") ?? 0);
  if (!Number.isFinite(confirmedUsdcAmount) || confirmedUsdcAmount < 0) {
    redirectWithError("/admin/reports/capital-circle", "Enter the actual USDC amount received (0 or more).");
  }

  const sweep = await prisma.capitalCircleSweep.findUnique({ where: { id: sweepId } });
  if (!sweep) {
    redirectWithError("/admin/reports/capital-circle", "That sweep no longer exists.");
  }
  if (sweep.status === "confirmed") {
    redirectWithError("/admin/reports/capital-circle", "That sweep is already confirmed.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.capitalCircleSweep.update({
      where: { id: sweepId },
      data: {
        status: "confirmed",
        confirmedUsdcAmount: confirmedUsdcAmount.toFixed(2),
        confirmedBy: "admin",
        confirmedAt: new Date(),
      },
    });
    await logAdminAction(
      {
        action: "capital-circle.sweep.confirm",
        entityType: "capital_circle_sweep",
        entityId: sweepId,
        summary: `Capital Circle sweep for week of ${sweep.weekStart.toISOString().slice(0, 10)} confirmed: $${confirmedUsdcAmount.toFixed(2)} USDC received.`,
        metadata: { weekStart: sweep.weekStart.toISOString(), proposedUsd: Number(sweep.sweepAmountUsd), confirmedUsdcAmount },
      },
      tx,
    );
  });

  revalidatePath("/admin/reports/capital-circle");
  redirectWithSuccess("/admin/reports/capital-circle", "Sweep confirmed.");
}
