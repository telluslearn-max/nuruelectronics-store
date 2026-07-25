import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "./prisma";
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE_SECONDS,
  buildAdminSessionValue,
  constantTimeEqual,
  isValidAdminSessionValue,
} from "./admin-session-token";
import { getClientIp } from "./request-ip";

export { getClientIp };

const username = process.env.ADMIN_USERNAME;
const password = process.env.ADMIN_PASSWORD;
const sessionSecret = process.env.ADMIN_SESSION_SECRET;

const LOGIN_LOCKOUT_WINDOW_MINUTES = 15;
const LOGIN_LOCKOUT_MAX_ATTEMPTS = 5;

export const isAdminAuthConfigured = Boolean(username && password && sessionSecret);

export function verifyAdminCredentials(candidateUsername: string, candidatePassword: string): boolean {
  if (!isAdminAuthConfigured) return false;
  return (
    constantTimeEqual(candidateUsername, username as string) &&
    constantTimeEqual(candidatePassword, password as string)
  );
}

export async function isLoginLockedOut(ipAddress: string): Promise<boolean> {
  const since = new Date(Date.now() - LOGIN_LOCKOUT_WINDOW_MINUTES * 60 * 1000);
  const failedAttempts = await prisma.adminLoginAttempt.count({
    where: { ipAddress, success: false, createdAt: { gte: since } },
  });
  return failedAttempts >= LOGIN_LOCKOUT_MAX_ATTEMPTS;
}

export async function recordLoginAttempt(ipAddress: string, success: boolean): Promise<void> {
  await prisma.adminLoginAttempt.create({ data: { ipAddress, success } });
}

export async function createAdminSession(): Promise<void> {
  const cookieStore = await cookies();
  const expiresAt = Date.now() + ADMIN_SESSION_MAX_AGE_SECONDS * 1000;
  cookieStore.set(ADMIN_SESSION_COOKIE, buildAdminSessionValue(expiresAt, sessionSecret as string), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
    path: "/",
  });
}

export async function getAdminSession(): Promise<boolean> {
  if (!isAdminAuthConfigured) return false;
  const cookieStore = await cookies();
  return isValidAdminSessionValue(cookieStore.get(ADMIN_SESSION_COOKIE)?.value, sessionSecret);
}

export async function clearAdminSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_SESSION_COOKIE);
}

/**
 * Belt-and-suspenders check for Server Components/Actions: proxy.ts only
 * performs an optimistic redirect and can be bypassed for Server Function
 * calls on routes its matcher excludes, so every admin page/action must also
 * verify the session itself rather than relying on proxy alone.
 */
export async function requireAdminSession(): Promise<void> {
  const authed = await getAdminSession();
  if (!authed) {
    redirect("/admin/login");
  }
}
