"use client";

import { makeConfirmClickHandler } from "./confirm-click-handler";

/** Wraps a plain (non-server-action) form submit button with a native confirm() prompt —
    for forms that POST to a route handler via a string `action`, not a server action. */
export function ConfirmSubmitButton({
  confirmMessage,
  className,
  children,
}: {
  confirmMessage: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button type="submit" className={className} onClick={makeConfirmClickHandler(confirmMessage)}>
      {children}
    </button>
  );
}
