"use client";

export function ConfirmSubmitButton({
  confirmMessage,
  className,
  formAction,
  children,
}: {
  confirmMessage: string;
  className?: string;
  formAction?: (formData: FormData) => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      formAction={formAction}
      className={className}
      onClick={(event) => {
        if (!confirm(confirmMessage)) event.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
