import { prisma } from "@/lib/prisma";
import { canAccessDocument } from "@/lib/document-access";
import { renderEstimatePdf } from "@/lib/pdf/render";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = new URL(request.url).searchParams.get("token");

  const estimate = await prisma.estimate.findUnique({
    where: { id },
    include: { order: { include: { customer: true, items: true } } },
  });
  if (!estimate) return new Response("Not found", { status: 404 });

  const authorized = token
    ? token === estimate.accessToken
    : await canAccessDocument(estimate.order.customer.email);
  if (!authorized) return new Response("Not found", { status: 404 });

  const pdfBuffer = await renderEstimatePdf(estimate, estimate.order, estimate.order.customer, estimate.order.items);
  return new Response(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${estimate.number}.pdf"`,
    },
  });
}
