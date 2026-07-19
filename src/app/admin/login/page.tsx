import type { Metadata } from "next";
import { isAdminAuthConfigured } from "@/lib/admin-auth";

export const metadata: Metadata = {
  title: "Admin sign in",
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  if (!isAdminAuthConfigured) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <h1 className="text-title">Admin isn&apos;t configured yet</h1>
        <p className="mt-2 max-w-sm text-neutral-500">
          Set ADMIN_USERNAME, ADMIN_PASSWORD, and ADMIN_SESSION_SECRET to enable the admin area.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col items-center justify-center py-24">
      <h1 className="text-title">Admin sign in</h1>
      {error === "locked" && (
        <p className="mt-6 w-full rounded-card border border-border-subtle bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
          Too many failed sign-in attempts. Try again in 15 minutes.
        </p>
      )}
      {error && error !== "locked" && (
        <p className="mt-6 w-full rounded-card border border-border-subtle bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
          Invalid username or password.
        </p>
      )}
      <form action="/api/admin/login" method="POST" className="mt-8 w-full space-y-4">
        <div>
          <label htmlFor="username" className="block text-sm font-medium">
            Username
          </label>
          <input
            id="username"
            name="username"
            type="text"
            required
            autoComplete="username"
            className="mt-1 w-full rounded-control border border-border-subtle px-4 py-2 text-sm outline-none focus:border-foreground"
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="mt-1 w-full rounded-control border border-border-subtle px-4 py-2 text-sm outline-none focus:border-foreground"
          />
        </div>
        <button
          type="submit"
          className="w-full rounded-control bg-foreground px-6 py-3 text-sm font-medium text-background transition hover:opacity-90"
        >
          Sign in
        </button>
      </form>
    </div>
  );
}
