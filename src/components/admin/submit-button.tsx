"use client";

import { useFormStatus } from "react-dom";

/** Disables itself and swaps in `pendingText` while its parent form is submitting — a Server
    Action's own submit has no built-in loading feedback otherwise, risking a double-click
    double-submit on slow connections. */
export function SubmitButton({
  className,
  children,
  pendingText = "Saving…",
}: {
  className?: string;
  children: React.ReactNode;
  pendingText?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? pendingText : children}
    </button>
  );
}
