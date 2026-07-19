import "server-only";
import { redirect } from "next/navigation";

function withParam(path: string, key: string, value: string): string {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}${key}=${encodeURIComponent(value)}`;
}

/** Redirects back to `path` with a message FeedbackBanner can render inline instead of throwing (which crashes to the error boundary). */
export function redirectWithError(path: string, message: string): never {
  redirect(withParam(path, "error", message));
}

export function redirectWithSuccess(path: string, message: string): never {
  redirect(withParam(path, "success", message));
}
