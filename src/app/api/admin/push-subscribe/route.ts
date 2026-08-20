import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

/** Registers (or re-registers) this browser's Web Push endpoint so it can receive
 * "position taken" notifications — see src/lib/push.ts and public/sw.js. */
export async function POST(request: Request) {
  if (!(await getAdminSession())) return new Response("Not found", { status: 404 });

  const body = await request.json().catch(() => null);
  const endpoint = typeof body?.endpoint === "string" ? body.endpoint : "";
  const p256dh = typeof body?.keys?.p256dh === "string" ? body.keys.p256dh : "";
  const authKey = typeof body?.keys?.auth === "string" ? body.keys.auth : "";
  if (!endpoint || !p256dh || !authKey) {
    return NextResponse.json({ error: "Missing endpoint or keys." }, { status: 400 });
  }

  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: { endpoint, p256dh, authKey },
    update: { p256dh, authKey },
  });
  return NextResponse.json({ ok: true });
}

/** Drops a subscription — called when the admin turns notifications off in their browser. */
export async function DELETE(request: Request) {
  if (!(await getAdminSession())) return new Response("Not found", { status: 404 });

  const body = await request.json().catch(() => null);
  const endpoint = typeof body?.endpoint === "string" ? body.endpoint : "";
  if (!endpoint) return NextResponse.json({ error: "Missing endpoint." }, { status: 400 });

  await prisma.pushSubscription.deleteMany({ where: { endpoint } });
  return NextResponse.json({ ok: true });
}
