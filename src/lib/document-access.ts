import "server-only";
import { getAdminSession } from "./admin-auth";
import { getCurrentCustomer } from "./customer";

/**
 * Authorizes a request for a document belonging to `ownerEmail`: either an
 * admin session, or a signed-in Shopify customer whose email matches. Never
 * trust a document's `[id]` URL param alone — always check this first.
 */
export async function canAccessDocument(ownerEmail: string | null): Promise<boolean> {
  if (await getAdminSession()) return true;
  if (!ownerEmail) return false;
  const customer = await getCurrentCustomer();
  return Boolean(customer?.email && customer.email.toLowerCase() === ownerEmail.toLowerCase());
}
