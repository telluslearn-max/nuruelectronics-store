"use client";

import { useFormStatus } from "react-dom";
import { makeConfirmClickHandler } from "../confirm-click-handler";

/**
 * Confirm-then-submit button for forms using a server-action `formAction` — needs
 * `useFormStatus` (only usable inside such a form) to disable itself and show `pendingText`
 * while the action runs. For a plain string-`action` form, use the non-admin
 * `ConfirmSubmitButton` in `components/confirm-submit-button.tsx` instead — that one can't use
 * this hook at all, which is why this is a separate, distinctly-named component rather than the
 * same one wearing two hats (see confirm-click-handler.ts for the reasoning).
 */
export function ConfirmPendingSubmitButton({
  confirmMessage,
  className,
  formAction,
  children,
  pendingText = "Deleting…",
}: {
  confirmMessage: string;
  className?: string;
  formAction?: (formData: FormData) => void;
  children: React.ReactNode;
  pendingText?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      formAction={formAction}
      disabled={pending}
      className={className}
      onClick={makeConfirmClickHandler(confirmMessage)}
    >
      {pending ? pendingText : children}
    </button>
  );
}
