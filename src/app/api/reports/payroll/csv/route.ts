import { getAdminSession } from "@/lib/admin-auth";
import { getPayrollReport, payrollReportToCsv } from "@/lib/reports/payroll-report";

export async function GET() {
  if (!(await getAdminSession())) return new Response("Not found", { status: 404 });

  const { rows } = await getPayrollReport();
  const csv = payrollReportToCsv(rows);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="payroll-register.csv"`,
    },
  });
}
