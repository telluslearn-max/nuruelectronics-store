// One-off/maintenance utility: writes the P&L template layout (labels only,
// no data) into an existing Google Sheet tab that the configured service
// account has Editor access to. Service accounts can't create/own Drive
// files themselves (no storage quota), so the target spreadsheet must
// already exist and be shared with GOOGLE_SERVICE_ACCOUNT_EMAIL first.
//
// Usage: node scripts/write-pnl-sheet-layout.mjs <spreadsheetId> [tabName]
import "dotenv/config";
import { google } from "googleapis";

const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n");
const spreadsheetId = process.argv[2];
const tabName = process.argv[3] ?? "P&L";

if (!spreadsheetId) {
  console.error("Usage: node scripts/write-pnl-sheet-layout.mjs <spreadsheetId> [tabName]");
  process.exit(1);
}

const auth = new google.auth.JWT({
  email,
  key,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});
const sheets = google.sheets({ version: "v4", auth });

const YEAR = new Date().getFullYear();
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const rows = [
  ["NURU Electronics"],
  ["PROFIT & LOSS STATEMENT"],
  [],
  ["Description", ...MONTHS, `Full ${YEAR}`],
  ["REVENUE"],
  ["Independent Sales (ie. sales of product or service)"],
  ["Related Party Revenue (ie. see Rules)"],
  ["TOTAL REVENUE"],
  [],
  ["EXPENSES"],
  ["COGS"],
  ["Personnel"],
  ["Software Subscriptions"],
  ["Tokens"],
  ["SG&A"],
  ["Personnel"],
  ["Software Subscriptions"],
  ["Tokens"],
  ["Other Expenses"],
  ["Other expenses (see Legend)"],
  ["TOTAL EXPENSES"],
  [],
  ["PROFIT (LOSS)"],
];

async function ensureTabExists() {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const exists = meta.data.sheets?.some((s) => s.properties?.title === tabName);
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title: tabName } } }] },
    });
  }
}

async function main() {
  await ensureTabExists();
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${tabName}!A1`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: rows },
  });
  console.log(`Layout written to "${tabName}" tab.`);
  console.log(`URL: https://docs.google.com/spreadsheets/d/${spreadsheetId}`);
}

main().catch((err) => {
  console.error("FAILED:", err.message);
  process.exit(1);
});
