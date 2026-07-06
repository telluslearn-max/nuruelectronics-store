import { NextResponse } from "next/server";
import { buildAuthorizationUrl, isCustomerAuthConfigured } from "@/lib/customer-auth";

export async function GET(request: Request) {
  if (!isCustomerAuthConfigured) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  const authorizationUrl = await buildAuthorizationUrl();
  return NextResponse.redirect(authorizationUrl);
}
