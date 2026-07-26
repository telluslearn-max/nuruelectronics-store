"use client";

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
    <button
      type="submit"
      className={className}
      onClick={(event) => {
        if (!confirm(confirmMessage)) event.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
