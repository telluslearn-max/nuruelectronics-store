"use server";

import { revalidatePath } from "next/cache";
import { requireAdminSession } from "./admin-auth";
import { computePnl } from "./reports/pnl";
import { writePnlToSheet } from "./google-sheets";

export async function syncPnlNow(): Promise<void> {
  await requireAdminSession();

  const now = new Date();
  const from = new Date(now.getFullYear(), 0, 1);
  const to = new Date(now.getFullYear() + 1, 0, 1);
  const pnl = await computePnl({ from, to, granularity: "monthly" });
  await writePnlToSheet(pnl);

  revalidatePath("/admin/reports/pnl");
}
