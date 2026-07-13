import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-auth";
import { renderPayslipPdf } from "@/lib/pdf/render";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getAdminSession())) return new Response("Not found", { status: 404 });

  const { id } = await params;
  const payslip = await prisma.payslip.findUnique({
    where: { id },
    include: { employee: true, deductions: true, payRun: true },
  });
  if (!payslip) return new Response("Not found", { status: 404 });

  const pdfBuffer = await renderPayslipPdf(payslip, payslip.employee, payslip.deductions, payslip.payRun);
  return new Response(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${payslip.number}.pdf"`,
    },
  });
}
