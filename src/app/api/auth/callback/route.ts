import { NextResponse } from "next/server";
import { completeLogin, isCustomerAuthConfigured } from "@/lib/customer-auth";

export async function GET(request: Request) {
  if (!isCustomerAuthConfigured) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (!code || !state) {
    return NextResponse.redirect(new URL("/account?error=1", request.url));
  }

  const success = await completeLogin(code, state);
  return NextResponse.redirect(
    new URL(success ? "/account" : "/account?error=1", request.url),
  );
}
