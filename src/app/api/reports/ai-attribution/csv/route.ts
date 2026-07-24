import { getAdminSession } from "@/lib/admin-auth";
import { conciergeAttributionReportToCsv, getConciergeAttributionReport } from "@/lib/reports/concierge-attribution";

export async function GET() {
  if (!(await getAdminSession())) return new Response("Not found", { status: 404 });

  const { rows } = await getConciergeAttributionReport();
  const csv = conciergeAttributionReportToCsv(rows);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ai-concierge-attribution.csv"`,
    },
  });
}
