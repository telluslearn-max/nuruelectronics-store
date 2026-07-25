import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { constantTimeEqual } from "@/lib/admin-session-token";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const formData = await request.formData();
  const token = String(formData.get("token") ?? "");
  const action = String(formData.get("action") ?? "");

  const estimate = await prisma.estimate.findUnique({ where: { id } });
  const redirectUrl = new URL(`/estimates/${id}`, request.url);
  redirectUrl.searchParams.set("token", token);

  if (!estimate || !constantTimeEqual(estimate.accessToken, token)) {
    return new Response("Not found", { status: 404 });
  }

  const isRespondable =
    (estimate.status === "draft" || estimate.status === "sent") && estimate.validUntil.getTime() > Date.now();

  if (isRespondable && (action === "accept" || action === "decline")) {
    await prisma.estimate.update({
      where: { id },
      data: { status: action === "accept" ? "accepted" : "declined", respondedAt: new Date() },
    });
  }

  return NextResponse.redirect(redirectUrl);
}
