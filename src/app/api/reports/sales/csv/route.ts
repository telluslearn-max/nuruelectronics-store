import { getAdminSession } from "@/lib/admin-auth";
import { getSalesReport, salesReportToCsv } from "@/lib/reports/sales";

export async function GET() {
  if (!(await getAdminSession())) return new Response("Not found", { status: 404 });

  const { rows } = await getSalesReport();
  const csv = salesReportToCsv(rows);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="sales-register.csv"`,
    },
  });
}
