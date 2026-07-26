"use client";

import { useFormStatus } from "react-dom";

export function ConfirmSubmitButton({
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
      onClick={(event) => {
        if (!confirm(confirmMessage)) event.preventDefault();
      }}
    >
      {pending ? pendingText : children}
    </button>
  );
}
