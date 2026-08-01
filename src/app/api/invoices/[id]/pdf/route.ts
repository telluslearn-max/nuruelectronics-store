import { prisma } from "@/lib/prisma";
import { canAccessDocument } from "@/lib/document-access";
import { renderInvoicePdf } from "@/lib/pdf/render";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: { order: { include: { customer: true, items: true } }, receipts: true },
  });
  if (!invoice) return new Response("Not found", { status: 404 });

  if (!(await canAccessDocument(invoice.order.customer.email))) {
    return new Response("Not found", { status: 404 });
  }

  const pdfBuffer = await renderInvoicePdf(
    invoice,
    invoice.order,
    invoice.order.customer,
    invoice.order.items,
    invoice.receipts,
  );
  return new Response(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${invoice.number}.pdf"`,
    },
  });
}
