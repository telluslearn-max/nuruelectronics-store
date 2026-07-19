import { getAdminSession } from "@/lib/admin-auth";
import { getTrialBalance, trialBalanceToCsv } from "@/lib/reports/trial-balance";

export async function GET() {
  if (!(await getAdminSession())) return new Response("Not found", { status: 404 });

  const rows = await getTrialBalance();
  const csv = trialBalanceToCsv(rows);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="trial-balance.csv"`,
    },
  });
}
