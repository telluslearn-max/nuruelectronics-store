import { NextResponse } from "next/server";
import { getLogoutUrl, isCustomerAuthConfigured } from "@/lib/customer-auth";

export async function GET(request: Request) {
  if (!isCustomerAuthConfigured) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  const logoutUrl = await getLogoutUrl();
  return NextResponse.redirect(logoutUrl);
}
