import type { MouseEvent } from "react";

/**
 * The shared "confirm before submitting" native-dialog guard used by both confirm-submit-button
 * components (this directory and `admin/`). The two components can't be merged into one — the
 * admin variant needs `useFormStatus`, which only works inside a form using a server-action
 * `formAction`, while this one is explicitly for plain string-`action` forms where that hook
 * isn't usable (see each component's own doc comment) — so per A Philosophy of Software Design
 * Ch. 14.1, forcing them into one name/component would just recreate the book's own `block`
 * naming-bug story at a different scale. This factors out only the 3 lines that actually were
 * duplicated between them.
 */
export function makeConfirmClickHandler(confirmMessage: string) {
  return (event: MouseEvent<HTMLButtonElement>) => {
    if (!confirm(confirmMessage)) event.preventDefault();
  };
}
