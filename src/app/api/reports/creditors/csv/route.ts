import { getAdminSession } from "@/lib/admin-auth";
import { getOutstandingBills, outstandingBillsToCsv } from "@/lib/reports/creditors";

export async function GET() {
  if (!(await getAdminSession())) return new Response("Not found", { status: 404 });

  const rows = await getOutstandingBills();
  const csv = outstandingBillsToCsv(rows);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="creditors.csv"`,
    },
  });
}
