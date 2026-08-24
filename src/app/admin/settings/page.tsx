import type { Metadata } from "next";
import { requireAdminSession } from "@/lib/admin-auth";
import { getSettings } from "@/lib/settings";
import { updateSettings } from "@/lib/settings-actions";
import { FeedbackBanner } from "@/components/admin/feedback-banner";
import { SubmitButton } from "@/components/admin/submit-button";

export const metadata: Metadata = { title: "Settings" };

const inputClass =
  "w-full rounded-control border border-border-subtle px-3 py-2 text-base outline-none focus:border-foreground sm:text-sm";
const primaryButtonClass =
  "rounded-control bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90";

const PREFIX_FIELDS: { name: string; label: string; placeholder: string }[] = [
  { name: "documentNumberPrefixEstimate", label: "Estimate prefix", placeholder: "EST" },
  { name: "documentNumberPrefixInvoice", label: "Invoice prefix", placeholder: "INV" },
  { name: "documentNumberPrefixReceipt", label: "Receipt prefix", placeholder: "RCT" },
  { name: "documentNumberPrefixDeliveryNote", label: "Delivery note prefix", placeholder: "DN" },
  { name: "documentNumberPrefixBill", label: "Bill prefix", placeholder: "BILL" },
  { name: "documentNumberPrefixPayslip", label: "Payslip prefix", placeholder: "PAY" },
];

export default async function AdminSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  await requireAdminSession();
  const settings = await getSettings();
  const { success, error } = await searchParams;

  return (
    <div>
      <h2 className="text-lg font-medium">Settings</h2>
      <FeedbackBanner success={success} error={error} />
      <p className="mt-2 text-neutral-500">
        Company details used on PDFs and emails, and overrides for document number prefixes.
      </p>

      <form action={updateSettings} className="mt-6 max-w-2xl space-y-8">
        <div>
          <h3 className="text-sm font-medium text-neutral-500">Company</h3>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-xs text-neutral-500">Company name</label>
              <input type="text" name="companyName" defaultValue={settings.companyName} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs text-neutral-500">Email</label>
              <input type="email" name="companyEmail" defaultValue={settings.companyEmail ?? ""} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs text-neutral-500">Phone</label>
              <input type="text" name="companyPhone" defaultValue={settings.companyPhone ?? ""} className={inputClass} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-neutral-500">Address</label>
              <input type="text" name="companyAddress" defaultValue={settings.companyAddress ?? ""} className={inputClass} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-neutral-500">Logo URL</label>
              <input
                type="url"
                name="logoUrl"
                defaultValue={settings.logoUrl ?? ""}
                placeholder="https://…"
                className={inputClass}
              />
              <p className="mt-1 text-xs text-neutral-500">
                Link to an already-hosted image. Shown on invoice/estimate/receipt PDFs when set.
              </p>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium text-neutral-500">Billing defaults</h3>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs text-neutral-500">Currency code</label>
              <input type="text" name="currencyCode" defaultValue={settings.currencyCode} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs text-neutral-500">Default tax rate (%)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                name="defaultTaxRatePercent"
                defaultValue={settings.defaultTaxRatePercent.toString()}
                className={inputClass}
              />
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium text-neutral-500">Document number prefixes</h3>
          <p className="mt-1 text-xs text-neutral-500">Leave blank to keep the default (e.g. INV-2026-0001).</p>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {PREFIX_FIELDS.map((field) => (
              <div key={field.name}>
                <label className="block text-xs text-neutral-500">{field.label}</label>
                <input
                  type="text"
                  name={field.name}
                  defaultValue={(settings[field.name as keyof typeof settings] as string | null) ?? ""}
                  placeholder={field.placeholder}
                  className={inputClass}
                />
              </div>
            ))}
          </div>
        </div>

        <SubmitButton className={primaryButtonClass}>Save settings</SubmitButton>
      </form>
    </div>
  );
}
