import { getAdminSession } from "@/lib/admin-auth";
import { getOutstandingInvoices, outstandingInvoicesToCsv } from "@/lib/reports/overdue-invoices";

export async function GET() {
  if (!(await getAdminSession())) return new Response("Not found", { status: 404 });

  const rows = await getOutstandingInvoices();
  const csv = outstandingInvoicesToCsv(rows);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="debtors.csv"`,
    },
  });
}
