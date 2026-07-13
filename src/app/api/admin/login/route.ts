import { NextResponse } from "next/server";
import { createAdminSession, isAdminAuthConfigured, verifyAdminCredentials } from "@/lib/admin-auth";

export async function POST(request: Request) {
  if (!isAdminAuthConfigured) {
    return NextResponse.redirect(new URL("/admin/login?error=1", request.url));
  }

  const formData = await request.formData();
  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!verifyAdminCredentials(username, password)) {
    return NextResponse.redirect(new URL("/admin/login?error=1", request.url));
  }

  await createAdminSession();
  return NextResponse.redirect(new URL("/admin", request.url));
}
