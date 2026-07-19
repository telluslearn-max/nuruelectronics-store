"use client";

import { useEffect, useState } from "react";

/**
 * Sticky selection header for a bulk-actions form. The checkboxes it drives
 * (name="ids") and the action buttons (children) are plain form elements
 * that work without JS — "select all" and the live count are convenience
 * enhancements only, not required for the form to submit successfully.
 */
export function BulkSelectionBar({ formId, children }: { formId: string; children: React.ReactNode }) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form) return;
    const update = () => setCount(form.querySelectorAll<HTMLInputElement>('input[name="ids"]:checked').length);
    form.addEventListener("change", update);
    update();
    return () => form.removeEventListener("change", update);
  }, [formId]);

  function toggleAll(event: React.ChangeEvent<HTMLInputElement>) {
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form) return;
    form.querySelectorAll<HTMLInputElement>('input[name="ids"]').forEach((checkbox) => {
      checkbox.checked = event.target.checked;
    });
    setCount(form.querySelectorAll<HTMLInputElement>('input[name="ids"]:checked').length);
  }

  return (
    <div className="sticky top-0 z-10 mb-3 flex flex-wrap items-center justify-between gap-3 rounded-card border border-border-subtle bg-background/95 p-3 text-sm backdrop-blur">
      <label className="flex items-center gap-2">
        <input type="checkbox" onChange={toggleAll} className="h-4 w-4" />
        <span>{count !== null ? `${count} selected` : "Select all"}</span>
      </label>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}
