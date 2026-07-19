"use server";

import { revalidatePath } from "next/cache";
import { requireAdminSession } from "./admin-auth";
import { computePnl } from "./reports/pnl";
import { writePnlToSheet } from "./google-sheets";
import { redirectWithError, redirectWithSuccess } from "./admin-feedback";

export async function syncPnlNow(): Promise<void> {
  await requireAdminSession();

  const now = new Date();
  const from = new Date(now.getFullYear(), 0, 1);
  const to = new Date(now.getFullYear() + 1, 0, 1);
  const pnl = await computePnl({ from, to, granularity: "monthly" });

  try {
    await writePnlToSheet(pnl);
  } catch (error) {
    redirectWithError(
      "/admin/reports/pnl",
      error instanceof Error ? `Google Sheets sync failed: ${error.message}` : "Google Sheets sync failed.",
    );
  }

  revalidatePath("/admin/reports/pnl");
  redirectWithSuccess("/admin/reports/pnl", "Synced to Google Sheet.");
}
