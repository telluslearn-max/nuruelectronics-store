import "server-only";
import { randomBytes, createHash } from "node:crypto";
import { cookies } from "next/headers";
import { SITE_URL } from "./site";

const REDIRECT_URI = `${SITE_URL}/api/auth/callback`;
const SCOPE = "openid email customer-account-api:full";

const domain = process.env.SHOPIFY_STORE_DOMAIN;
const clientId = process.env.SHOPIFY_CUSTOMER_ACCOUNT_API_CLIENT_ID;
const clientSecret = process.env.SHOPIFY_CUSTOMER_ACCOUNT_API_CLIENT_SECRET;

export const isCustomerAuthConfigured = Boolean(domain && clientId && clientSecret);

const OAUTH_COOKIE = "customer_oauth";
const SESSION_COOKIE = "customer_session";

type Discovery = {
  authorizationEndpoint: string;
  tokenEndpoint: string;
  endSessionEndpoint: string | null;
  graphqlApiEndpoint: string;
};

type TokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
};

type Session = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
};

let discoveryPromise: Promise<Discovery> | null = null;

async function fetchDiscovery(): Promise<Discovery> {
  const [openIdConfig, customerApiConfig] = await Promise.all([
    fetch(`https://${domain}/.well-known/openid-configuration`).then((r) => r.json()),
    fetch(`https://${domain}/.well-known/customer-account-api`).then((r) => r.json()),
  ]);
  return {
    authorizationEndpoint: openIdConfig.authorization_endpoint,
    tokenEndpoint: openIdConfig.token_endpoint,
    endSessionEndpoint: openIdConfig.end_session_endpoint ?? null,
    graphqlApiEndpoint: customerApiConfig.graphql_api,
  };
}

export function getDiscovery(): Promise<Discovery> {
  if (!discoveryPromise) discoveryPromise = fetchDiscovery();
  return discoveryPromise;
}

function base64url(input: Buffer): string {
  return input.toString("base64url");
}

export function createPkcePair(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = base64url(randomBytes(32));
  const codeChallenge = base64url(createHash("sha256").update(codeVerifier).digest());
  return { codeVerifier, codeChallenge };
}

export function createState(): string {
  return base64url(randomBytes(16));
}

export async function buildAuthorizationUrl(): Promise<string> {
  const discovery = await getDiscovery();
  const { codeVerifier, codeChallenge } = createPkcePair();
  const state = createState();

  const cookieStore = await cookies();
  cookieStore.set(OAUTH_COOKIE, JSON.stringify({ state, codeVerifier }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 600,
    path: "/",
  });

  const url = new URL(discovery.authorizationEndpoint);
  url.searchParams.set("client_id", clientId as string);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", REDIRECT_URI);
  url.searchParams.set("scope", SCOPE);
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

export async function completeLogin(code: string, state: string): Promise<boolean> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(OAUTH_COOKIE)?.value;
  cookieStore.delete(OAUTH_COOKIE);
  if (!raw) return false;

  const stored = JSON.parse(raw) as { state: string; codeVerifier: string };
  if (stored.state !== state) return false;

  const discovery = await getDiscovery();
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetch(discovery.tokenEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basicAuth}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId as string,
      redirect_uri: REDIRECT_URI,
      code,
      code_verifier: stored.codeVerifier,
    }),
  });
  if (!res.ok) return false;

  const tokens = (await res.json()) as TokenResponse;
  await setSession(tokens);
  return true;
}

async function setSession(tokens: TokenResponse): Promise<void> {
  const cookieStore = await cookies();
  const session: Session = {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: Date.now() + tokens.expires_in * 1000,
  };
  cookieStore.set(SESSION_COOKIE, JSON.stringify(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 60,
    path: "/",
  });
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

async function readSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

async function refreshSession(refreshToken: string): Promise<string | null> {
  const discovery = await getDiscovery();
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetch(discovery.tokenEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basicAuth}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: clientId as string,
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) {
    await clearSession();
    return null;
  }

  const tokens = (await res.json()) as TokenResponse;
  await setSession(tokens);
  return tokens.access_token;
}

const EXPIRY_BUFFER_MS = 60_000;

export async function getValidAccessToken(): Promise<string | null> {
  if (!isCustomerAuthConfigured) return null;
  const session = await readSession();
  if (!session) return null;
  if (session.expiresAt - EXPIRY_BUFFER_MS > Date.now()) return session.accessToken;
  return refreshSession(session.refreshToken);
}

export async function getLogoutUrl(): Promise<string> {
  const discovery = await getDiscovery();
  await clearSession();
  if (!discovery.endSessionEndpoint) return SITE_URL;
  const url = new URL(discovery.endSessionEndpoint);
  url.searchParams.set("post_logout_redirect_uri", SITE_URL);
  return url.toString();
}
