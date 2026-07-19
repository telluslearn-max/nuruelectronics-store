import { NextResponse } from "next/server";
import {
  createAdminSession,
  getClientIp,
  isAdminAuthConfigured,
  isLoginLockedOut,
  recordLoginAttempt,
  verifyAdminCredentials,
} from "@/lib/admin-auth";

export async function POST(request: Request) {
  if (!isAdminAuthConfigured) {
    return NextResponse.redirect(new URL("/admin/login?error=1", request.url));
  }

  const ipAddress = getClientIp(request);
  if (await isLoginLockedOut(ipAddress)) {
    return NextResponse.redirect(new URL("/admin/login?error=locked", request.url));
  }

  const formData = await request.formData();
  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!verifyAdminCredentials(username, password)) {
    await recordLoginAttempt(ipAddress, false);
    return NextResponse.redirect(new URL("/admin/login?error=1", request.url));
  }

  await recordLoginAttempt(ipAddress, true);
  await createAdminSession();
  return NextResponse.redirect(new URL("/admin", request.url));
}
