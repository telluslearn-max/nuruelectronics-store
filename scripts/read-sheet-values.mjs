import "dotenv/config";
import { google } from "googleapis";

const auth = new google.auth.JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});
const sheets = google.sheets({ version: "v4", auth });

const { data } = await sheets.spreadsheets.values.get({
  spreadsheetId: process.env.PNL_SHEET_ID,
  range: `${process.env.PNL_SHEET_TAB}!A1:N23`,
});

for (const row of data.values ?? []) {
  console.log(row.join(" | "));
}
