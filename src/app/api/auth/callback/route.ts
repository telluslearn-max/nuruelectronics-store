import { NextResponse } from "next/server";
import { completeLogin, isCustomerAuthConfigured } from "@/lib/customer-auth";
import { upsertSignedInCustomer } from "@/lib/customer";
import { backfillInteractionsForCustomer } from "@/lib/interactions";
import { getSessionId } from "@/lib/session";

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

  // The "delayed conversion" moment (task 2): a shopper who browsed/chatted anonymously for weeks
  // gets those Interaction rows attributed to their real identity the instant they sign in, not
  // only once they place an order.
  if (success) {
    const customer = await upsertSignedInCustomer();
    if (customer) {
      const sessionId = await getSessionId();
      if (sessionId) await backfillInteractionsForCustomer(sessionId, customer.id);
    }
  }

  return NextResponse.redirect(
    new URL(success ? "/account" : "/account?error=1", request.url),
  );
}
