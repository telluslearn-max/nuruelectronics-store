import { getAdminSession } from "@/lib/admin-auth";
import { getFixedAssetsReport, fixedAssetsReportToCsv } from "@/lib/reports/fixed-assets-report";

export async function GET() {
  if (!(await getAdminSession())) return new Response("Not found", { status: 404 });

  const rows = await getFixedAssetsReport();
  const csv = fixedAssetsReportToCsv(rows);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="fixed-assets.csv"`,
    },
  });
}
