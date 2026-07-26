import "server-only";
import { redirect } from "next/navigation";

/**
 * Thrown by the "Silent" variant of an action that's also used by a bulk
 * runner — the bulk path just wants a plain throw to catch and count as
 * skipped, but the single-item public action needs the redirect target to
 * show the failure as an inline banner instead of crashing to the error
 * boundary. Shared across action files (rather than defined per-file) so a
 * guard raised deep in a `$transaction` can redirect the caller to the right
 * page after rollback.
 */
export class ActionGuardError extends Error {
  constructor(
    message: string,
    public redirectPath: string,
  ) {
    super(message);
  }
}

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
