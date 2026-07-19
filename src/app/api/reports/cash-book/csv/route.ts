import { getAdminSession } from "@/lib/admin-auth";
import { getCashBook, cashBookToCsv } from "@/lib/reports/cash-book";

export async function GET() {
  if (!(await getAdminSession())) return new Response("Not found", { status: 404 });

  const rows = await getCashBook();
  const csv = cashBookToCsv(rows);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="cash-book.csv"`,
    },
  });
}
