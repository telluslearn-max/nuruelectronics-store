import { getAdminSession } from "@/lib/admin-auth";
import { computePnl, pnlToCsv } from "@/lib/reports/pnl";

export async function GET(request: Request) {
  if (!(await getAdminSession())) return new Response("Not found", { status: 404 });

  const { searchParams } = new URL(request.url);
  const granularity = searchParams.get("granularity") === "daily" ? "daily" : "monthly";
  const now = new Date();

  let from: Date;
  let to: Date;
  if (granularity === "daily") {
    const month = searchParams.get("month") ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const [year, monthNum] = month.split("-").map(Number);
    from = new Date(year, monthNum - 1, 1);
    to = new Date(year, monthNum, 1);
  } else {
    const year = Number(searchParams.get("year") ?? now.getFullYear());
    from = new Date(year, 0, 1);
    to = new Date(year + 1, 0, 1);
  }

  const pnl = await computePnl({ from, to, granularity });
  const csv = pnlToCsv(pnl);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="pnl-${granularity}.csv"`,
    },
  });
}
