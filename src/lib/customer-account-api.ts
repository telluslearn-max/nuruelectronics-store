import "server-only";
import { getDiscovery } from "./customer-auth";

export async function customerAccountFetch<T>(
  accessToken: string,
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const discovery = await getDiscovery();
  const res = await fetch(discovery.graphqlApiEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: accessToken,
      "User-Agent": "nuru-storefront",
    },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });

  const json = await res.json();
  if (json.errors) {
    throw new Error(json.errors.map((e: { message: string }) => e.message).join("\n"));
  }
  return json.data as T;
}
