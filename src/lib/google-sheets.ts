import "server-only";
import { google } from "googleapis";
import type { PnlResult } from "./reports/pnl";

const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const serviceAccountPrivateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n");
const sheetId = process.env.PNL_SHEET_ID;
const sheetTab = process.env.PNL_SHEET_TAB;

export const isGoogleSheetsConfigured = Boolean(
  serviceAccountEmail && serviceAccountPrivateKey && sheetId && sheetTab,
);

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Text labels this sync matches against the sheet's actual cells, rather than
// hardcoded row/column numbers. COGS and SG&A each have their own Personnel /
// Software Subscriptions / Tokens sub-rows in the shared template — "Tokens"
// doesn't correspond to anything in this store's operations (it's a leftover
// from the template's original hackathon-accounting purpose), so it's reused
// here as the catch-all for any expense subcategory that isn't exactly
// "Personnel" or "Software Subscriptions".
const REVENUE_LABEL = "Independent Sales";
const COGS_SECTION_LABEL = "COGS";
const SGA_SECTION_LABEL = "SG&A";
const OTHER_EXPENSES_LABEL = "Other expenses";
const PERSONNEL_LABEL = "Personnel";
const SOFTWARE_LABEL = "Software Subscriptions";
const TOKENS_LABEL = "Tokens";
const TOTAL_REVENUE_LABEL = "TOTAL REVENUE";
const TOTAL_EXPENSES_LABEL = "TOTAL EXPENSES";
const PROFIT_LABEL = "PROFIT (LOSS)";

export type SheetLayout = {
  monthColumns: Map<string, number>; // month name -> 0-based column index
  revenueRow: number | null;
  cogsPersonnelRow: number | null;
  cogsSoftwareRow: number | null;
  cogsOtherRow: number | null;
  sgaPersonnelRow: number | null;
  sgaSoftwareRow: number | null;
  sgaOtherRow: number | null;
  otherExpensesRow: number | null;
  totalRevenueRow: number | null;
  totalExpensesRow: number | null;
  profitRow: number | null;
};

function getSheetsClient() {
  const auth = new google.auth.JWT({
    email: serviceAccountEmail,
    key: serviceAccountPrivateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

/**
 * Reads the target tab once and locates every cell this sync needs by
 * matching its actual text, rather than assuming fixed row/column numbers —
 * the live sheet's exact layout can only be confirmed once real credentials
 * and sheet access are available, so this is deliberately layout-tolerant.
 */
export async function locateSheetLayout(): Promise<SheetLayout> {
  if (!isGoogleSheetsConfigured) {
    throw new Error(
      "Google Sheets isn't configured — set GOOGLE_SERVICE_ACCOUNT_EMAIL/PRIVATE_KEY, PNL_SHEET_ID, PNL_SHEET_TAB.",
    );
  }
  const sheets = getSheetsClient();
  const { data } = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `${sheetTab}!A1:Z60`,
  });
  const grid = data.values ?? [];

  const layout: SheetLayout = {
    monthColumns: new Map(),
    revenueRow: null,
    cogsPersonnelRow: null,
    cogsSoftwareRow: null,
    cogsOtherRow: null,
    sgaPersonnelRow: null,
    sgaSoftwareRow: null,
    sgaOtherRow: null,
    otherExpensesRow: null,
    totalRevenueRow: null,
    totalExpensesRow: null,
    profitRow: null,
  };

  let currentSection: "cogs" | "sga" | null = null;

  for (let rowIndex = 0; rowIndex < grid.length; rowIndex++) {
    const row = grid[rowIndex] ?? [];
    for (let colIndex = 0; colIndex < row.length; colIndex++) {
      const cell = String(row[colIndex] ?? "").trim();
      if (!cell) continue;

      if (rowIndex < 5 && MONTH_NAMES.includes(cell)) {
        layout.monthColumns.set(cell, colIndex);
        continue;
      }
      if (cell.startsWith(REVENUE_LABEL)) layout.revenueRow = rowIndex;
      if (cell === COGS_SECTION_LABEL) currentSection = "cogs";
      if (cell === SGA_SECTION_LABEL) currentSection = "sga";
      if (cell === PERSONNEL_LABEL) {
        if (currentSection === "cogs") layout.cogsPersonnelRow = rowIndex;
        if (currentSection === "sga") layout.sgaPersonnelRow = rowIndex;
      }
      if (cell === SOFTWARE_LABEL) {
        if (currentSection === "cogs") layout.cogsSoftwareRow = rowIndex;
        if (currentSection === "sga") layout.sgaSoftwareRow = rowIndex;
      }
      if (cell === TOKENS_LABEL) {
        if (currentSection === "cogs") layout.cogsOtherRow = rowIndex;
        if (currentSection === "sga") layout.sgaOtherRow = rowIndex;
      }
      if (cell.startsWith(OTHER_EXPENSES_LABEL)) {
        layout.otherExpensesRow = rowIndex;
        currentSection = null;
      }
      if (cell === TOTAL_REVENUE_LABEL) layout.totalRevenueRow = rowIndex;
      if (cell === TOTAL_EXPENSES_LABEL) layout.totalExpensesRow = rowIndex;
      if (cell === PROFIT_LABEL) layout.profitRow = rowIndex;
    }
  }

  return layout;
}

function columnToA1(col: number): string {
  let n = col + 1;
  let letters = "";
  while (n > 0) {
    const remainder = (n - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}

function monthColumnFor(layout: SheetLayout, bucket: string): number | undefined {
  // bucket is "YYYY-MM" for monthly granularity.
  const monthNum = Number(bucket.split("-")[1]);
  return layout.monthColumns.get(MONTH_NAMES[monthNum - 1]);
}

/**
 * Writes the computed monthly P&L into the located cells, overwriting the
 * whole configured month range each run (cheap for a sheet this size, and
 * idempotent). Only monthly `pnl` results make sense here — the template's
 * columns are months, not days.
 */
export async function writePnlToSheet(pnl: PnlResult): Promise<void> {
  if (pnl.granularity !== "monthly") {
    throw new Error("Only monthly P&L results can be synced to the Google Sheet — its columns are months.");
  }
  const layout = await locateSheetLayout();
  const sheets = getSheetsClient();

  const rowsByMetric: [number | null, Record<string, number>][] = [
    [layout.revenueRow, pnl.revenue],
    [layout.cogsPersonnelRow, pnl.cogsPersonnel],
    [layout.cogsSoftwareRow, pnl.cogsSoftware],
    [layout.cogsOtherRow, pnl.cogsOther],
    [layout.sgaPersonnelRow, pnl.sgaPersonnel],
    [layout.sgaSoftwareRow, pnl.sgaSoftware],
    [layout.sgaOtherRow, pnl.sgaOther],
    [layout.otherExpensesRow, pnl.otherExpenses],
    [layout.totalRevenueRow, pnl.totalRevenue],
    [layout.totalExpensesRow, pnl.totalExpenses],
    [layout.profitRow, pnl.profit],
  ];

  const cellUpdates: { row: number; col: number; value: number }[] = [];
  for (const bucket of pnl.buckets) {
    const col = monthColumnFor(layout, bucket);
    if (col === undefined) continue;
    for (const [row, values] of rowsByMetric) {
      if (row === null) continue;
      cellUpdates.push({ row, col, value: values[bucket] ?? 0 });
    }
  }

  if (cellUpdates.length === 0) {
    throw new Error(
      "No matching month columns or label rows found in the sheet — its layout may differ from what this sync expects. Check PNL_SHEET_TAB and the sheet's actual row/column text.",
    );
  }

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: {
      valueInputOption: "USER_ENTERED",
      data: cellUpdates.map((update) => ({
        range: `${sheetTab}!${columnToA1(update.col)}${update.row + 1}`,
        values: [[update.value]],
      })),
    },
  });
}
