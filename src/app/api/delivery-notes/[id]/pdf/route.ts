import { prisma } from "@/lib/prisma";
import { canAccessDocument } from "@/lib/document-access";
import { renderDeliveryNotePdf } from "@/lib/pdf/render";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const note = await prisma.deliveryNote.findUnique({
    where: { id },
    include: { order: { include: { customer: true, items: true } } },
  });
  if (!note) return new Response("Not found", { status: 404 });

  if (!(await canAccessDocument(note.order.customer.email))) {
    return new Response("Not found", { status: 404 });
  }

  const pdfBuffer = await renderDeliveryNotePdf(note, note.order, note.order.items);
  return new Response(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${note.number}.pdf"`,
    },
  });
}
