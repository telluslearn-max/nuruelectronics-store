import { prisma } from "@/lib/prisma";
import { canAccessDocument } from "@/lib/document-access";
import { renderReceiptPdf } from "@/lib/pdf/render";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const receipt = await prisma.receipt.findUnique({
    where: { id },
    include: { invoice: { include: { order: { include: { customer: true } } } } },
  });
  if (!receipt) return new Response("Not found", { status: 404 });

  if (!(await canAccessDocument(receipt.invoice.order.customer.email))) {
    return new Response("Not found", { status: 404 });
  }

  const pdfBuffer = await renderReceiptPdf(receipt, receipt.invoice, receipt.invoice.order.customer);
  return new Response(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${receipt.number}.pdf"`,
    },
  });
}
