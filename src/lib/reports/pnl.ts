import "server-only";
import { prisma } from "../prisma";
import { getShopifyPaidOrderTotals, isShopifyAdminConfigured } from "../shopify/admin-api";

export type PnlGranularity = "daily" | "monthly";

type BucketRecord = Record<string, number>;

export type PnlResult = {
  granularity: PnlGranularity;
  buckets: string[];
  revenue: BucketRecord;
  cogsPersonnel: BucketRecord;
  cogsSoftware: BucketRecord;
  cogsOther: BucketRecord;
  sgaPersonnel: BucketRecord;
  sgaSoftware: BucketRecord;
  sgaOther: BucketRecord;
  otherExpenses: BucketRecord;
  totalRevenue: BucketRecord;
  totalExpenses: BucketRecord;
  profit: BucketRecord;
};

function bucketKey(date: Date, granularity: PnlGranularity): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  if (granularity === "monthly") return `${year}-${month}`;
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function enumerateBuckets(from: Date, to: Date, granularity: PnlGranularity): string[] {
  const buckets: string[] = [];
  const cursor = new Date(from);
  while (cursor < to) {
    buckets.push(bucketKey(cursor, granularity));
    if (granularity === "monthly") {
      cursor.setMonth(cursor.getMonth() + 1);
    } else {
      cursor.setDate(cursor.getDate() + 1);
    }
  }
  return buckets;
}

function addTo(record: BucketRecord, key: string, amount: number): void {
  record[key] = (record[key] ?? 0) + amount;
}

/**
 * Cash-basis P&L (per the shared spreadsheet template's explicit "cash basis"
 * instruction): revenue is recognized when cash is actually received —
 * Receipts for manual/WhatsApp invoices, plus Shopify orders once paid — not
 * when an invoice is merely issued. This is deliberately a different view
 * from the accrual Income Statement in admin/reports/income-statement.
 *
 * COGS and SG&A are each split into Personnel / Software Subscriptions /
 * everything-else, matching the shared template's own sub-rows — an
 * Expense's `subcategory` free-text field is matched case-insensitively
 * against those two labels, with anything else falling into the "other"
 * bucket for that category.
 */
export async function computePnl({
  from,
  to,
  granularity,
}: {
  from: Date;
  to: Date;
  granularity: PnlGranularity;
}): Promise<PnlResult> {
  const buckets = enumerateBuckets(from, to, granularity);
  const revenue: BucketRecord = {};
  const cogsPersonnel: BucketRecord = {};
  const cogsSoftware: BucketRecord = {};
  const cogsOther: BucketRecord = {};
  const sgaPersonnel: BucketRecord = {};
  const sgaSoftware: BucketRecord = {};
  const sgaOther: BucketRecord = {};
  const otherExpenses: BucketRecord = {};

  const receipts = await prisma.receipt.findMany({ where: { paidAt: { gte: from, lt: to } } });
  for (const receipt of receipts) {
    addTo(revenue, bucketKey(receipt.paidAt, granularity), Number(receipt.amount));
  }

  if (isShopifyAdminConfigured) {
    try {
      const shopifyOrders = await getShopifyPaidOrderTotals(from, to);
      for (const order of shopifyOrders) {
        addTo(revenue, bucketKey(new Date(order.processedAt), granularity), Number(order.amount));
      }
    } catch {
      // Shopify Admin API unavailable/misconfigured — fall back to Receipt-only
      // revenue rather than failing the whole P&L (page, CSV export, and cron).
    }
  }

  const expenses = await prisma.expense.findMany({ where: { date: { gte: from, lt: to } } });
  for (const expense of expenses) {
    const key = bucketKey(expense.date, granularity);
    const amount = Number(expense.amount);
    const subcategory = expense.subcategory.trim().toLowerCase();

    if (expense.category === "other") {
      addTo(otherExpenses, key, amount);
    } else if (expense.category === "cogs") {
      if (subcategory === "personnel") addTo(cogsPersonnel, key, amount);
      else if (subcategory === "software subscriptions") addTo(cogsSoftware, key, amount);
      else addTo(cogsOther, key, amount);
    } else {
      if (subcategory === "personnel") addTo(sgaPersonnel, key, amount);
      else if (subcategory === "software subscriptions") addTo(sgaSoftware, key, amount);
      else addTo(sgaOther, key, amount);
    }
  }

  const totalRevenue: BucketRecord = {};
  const totalExpenses: BucketRecord = {};
  const profit: BucketRecord = {};
  for (const bucket of buckets) {
    totalRevenue[bucket] = revenue[bucket] ?? 0;
    totalExpenses[bucket] =
      (cogsPersonnel[bucket] ?? 0) +
      (cogsSoftware[bucket] ?? 0) +
      (cogsOther[bucket] ?? 0) +
      (sgaPersonnel[bucket] ?? 0) +
      (sgaSoftware[bucket] ?? 0) +
      (sgaOther[bucket] ?? 0) +
      (otherExpenses[bucket] ?? 0);
    profit[bucket] = totalRevenue[bucket] - totalExpenses[bucket];
  }

  return {
    granularity,
    buckets,
    revenue,
    cogsPersonnel,
    cogsSoftware,
    cogsOther,
    sgaPersonnel,
    sgaSoftware,
    sgaOther,
    otherExpenses,
    totalRevenue,
    totalExpenses,
    profit,
  };
}

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** CSV matching the sheet's row/column layout — one row per metric, one column per bucket, plus a period total. */
export function pnlToCsv(pnl: PnlResult): string {
  const metricRows: [string, BucketRecord][] = [
    ["Independent Sales", pnl.revenue],
    ["TOTAL REVENUE", pnl.totalRevenue],
    ["COGS: Personnel", pnl.cogsPersonnel],
    ["COGS: Software Subscriptions", pnl.cogsSoftware],
    ["COGS: Other", pnl.cogsOther],
    ["SG&A: Personnel", pnl.sgaPersonnel],
    ["SG&A: Software Subscriptions", pnl.sgaSoftware],
    ["SG&A: Other", pnl.sgaOther],
    ["Other Expenses", pnl.otherExpenses],
    ["TOTAL EXPENSES", pnl.totalExpenses],
    ["PROFIT (LOSS)", pnl.profit],
  ];

  const header = ["Description", ...pnl.buckets, "Total"].map(csvCell).join(",");
  const rows = metricRows.map(([label, values]) => {
    const cells = pnl.buckets.map((bucket) => (values[bucket] ?? 0).toFixed(2));
    const total = pnl.buckets.reduce((sum, bucket) => sum + (values[bucket] ?? 0), 0);
    return [label, ...cells, total.toFixed(2)].map(csvCell).join(",");
  });

  return [header, ...rows].join("\n");
}
