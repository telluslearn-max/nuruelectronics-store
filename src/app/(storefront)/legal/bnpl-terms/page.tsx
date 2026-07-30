import type { Metadata } from "next";
import Link from "next/link";
import { LegalDocument, LegalSection } from "@/components/legal-document";
import {
  LEGAL_DOCS_LAST_UPDATED,
  LEGAL_ENTITY_JURISDICTION,
  LEGAL_ENTITY_NAME,
  LEGAL_NOTICE_EMAIL,
  LEGAL_SUPPORT_EMAIL,
} from "@/lib/legal-entity";

export const metadata: Metadata = {
  title: "BNPL Credit Terms",
  description: `Terms for the Buy Now, Pay Later plans offered by ${LEGAL_ENTITY_NAME}.`,
};

export default function BnplTermsPage() {
  return (
    <LegalDocument title="Buy Now, Pay Later (BNPL) Credit Terms" lastUpdated={LEGAL_DOCS_LAST_UPDATED}>
      <p className="rounded-card border border-border-subtle bg-neutral-50 p-4 text-neutral-600">
        This page describes a real credit/financing arrangement, not a standard purchase. It has
        been drafted from how the BNPL feature currently works and has not been reviewed by a{" "}
        {LEGAL_ENTITY_JURISDICTION}-qualified lawyer. Given Kenya&apos;s Central Bank / Digital
        Credit Providers rules and the Data Protection Act, 2019 may apply to this flow, get this
        page reviewed before relying on it commercially.
      </p>

      <LegalSection heading="1. What BNPL is">
        <p>
          BNPL lets you buy selected products by paying a deposit up front and the remaining
          balance in installments, at a markup, instead of paying the full price at checkout. It
          is currently available on Apple-brand products only; other brands (Infinix, Oppo,
          Samsung, Tecno, Vivo, Xiaomi) are &quot;coming soon&quot; and not yet live.
        </p>
      </LegalSection>

      <LegalSection heading="2. Eligibility">
        <p>To apply for BNPL, you must provide:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>A valid national ID.</li>
          <li>3 months of M-Pesa statements.</li>
          <li>Confirmation that you are 18 years or older.</li>
        </ul>
        <p>Approval is at our discretion and is not guaranteed.</p>
      </LegalSection>

      <LegalSection heading="3. How the plans work">
        <p>Two plans are available. In both, the balance remaining after your deposit is marked up by 50% (you repay 1.5 times that balance):</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Weekly plan:</strong> 40% deposit, remaining balance (marked up 1.5x) repaid
            over 12 weekly installments.
          </li>
          <li>
            <strong>Monthly plan:</strong> 50% deposit, remaining balance (marked up 1.5x) repaid
            over 3 monthly installments.
          </li>
        </ul>
        <p>
          The exact deposit, installment amount, and total payable for your item are shown to you
          before you apply. The 1.5x markup is the cost of the plan — you will pay more in total
          than the item&apos;s listed price.
        </p>
      </LegalSection>

      <LegalSection heading="4. How to apply">
        <p>
          BNPL applications are not submitted through this website — you apply by messaging us on
          WhatsApp with the plan details, your national ID, and your M-Pesa statements. Because
          this happens over WhatsApp, the transport of that message is also subject to
          WhatsApp/Meta&apos;s own terms and privacy practices, separate from ours.
        </p>
        <p>
          We retain the ID and statement documents you send only for as long as needed to assess
          and administer your application, and access is limited to staff who process BNPL
          applications.
        </p>
      </LegalSection>

      <LegalSection heading="5. Missed or late payments">
        <p>
          {"[describe actual default process: e.g. grace period, late fees, deposit forfeiture, repossession of the item, and any credit reporting — confirm current practice before publishing]"}
        </p>
      </LegalSection>

      <LegalSection heading="6. Returns on BNPL orders">
        <p>
          If you return a product bought on a BNPL plan, see our{" "}
          <Link href="/legal/refund-policy" className="underline underline-offset-2">
            Refund &amp; Warranty Policy
          </Link>{" "}
          for how your deposit and paid installments are handled.
        </p>
      </LegalSection>

      <LegalSection heading="7. Governing law and contact">
        <p>
          These BNPL Credit Terms are governed by the laws of {LEGAL_ENTITY_JURISDICTION}. For
          questions or disputes about a BNPL plan, contact us at{" "}
          {LEGAL_SUPPORT_EMAIL ? (
            <a href={`mailto:${LEGAL_SUPPORT_EMAIL}`} className="underline underline-offset-2">
              {LEGAL_SUPPORT_EMAIL}
            </a>
          ) : (
            LEGAL_NOTICE_EMAIL
          )}
          .
        </p>
      </LegalSection>
    </LegalDocument>
  );
}
