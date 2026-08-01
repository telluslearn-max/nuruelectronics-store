import type { Metadata } from "next";
import Link from "next/link";
import { LegalContact, LegalDocument, LegalSection } from "@/components/legal-document";
import { LEGAL_DOCS_LAST_UPDATED, LEGAL_ENTITY_NAME } from "@/lib/legal-entity";

export const metadata: Metadata = {
  title: "Refund & Warranty Policy",
  description: `Returns, refunds, and warranty coverage for orders placed with ${LEGAL_ENTITY_NAME}.`,
};

export default function RefundPolicyPage() {
  return (
    <LegalDocument title="Refund & Warranty Policy" lastUpdated={LEGAL_DOCS_LAST_UPDATED}>
      <p>
        Every product we sell is checked before it ships. If something is wrong with your order,
        message us on WhatsApp (see our{" "}
        <Link href="/support" className="underline underline-offset-2">
          Support page
        </Link>
        ) and we&apos;ll sort it out. This policy explains how returns, refunds, and warranty
        claims work.
      </p>

      <LegalSection heading="1. Returns">
        <p>
          You may return a product within 7 days of delivery if it is unused, in its original
          packaging, and with all accessories included. Contact us before sending anything back so
          we can confirm eligibility and arrange collection or drop-off. See our{" "}
          <Link href="/returns" className="underline underline-offset-2">
            Returns page
          </Link>{" "}
          for the step-by-step process.
        </p>
      </LegalSection>

      <LegalSection heading="2. Warranty coverage">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Genuine new products</strong> are covered by the original manufacturer&apos;s
            warranty.
          </li>
          <li>
            <strong>Ex-UK (unboxed) products</strong> are not covered by the original
            manufacturer&apos;s warranty, but every ex-UK unit we sell comes with our own 1-year
            warranty against manufacturing defects and hardware faults.
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="3. How refunds are processed">
        <p>
          For orders paid through our Shopify checkout, approved refunds are issued back to your
          original payment method through Shopify. For orders paid by cash or M-Pesa outside of
          Shopify checkout, approved refunds are issued by M-Pesa or cash, matching how the order
          was originally paid.
        </p>
      </LegalSection>

      <LegalSection heading="4. Damaged, wrong, or missing items">
        <p>
          If your order arrives damaged, incorrect, or incomplete, contact us via WhatsApp within
          48 hours of delivery with photos of the item and packaging. We will replace, repair, or
          refund the item once verified.
        </p>
      </LegalSection>

      <LegalSection heading="5. BNPL orders">
        <p>
          We handle the return of the product itself under this policy. Your deposit, any
          installments already paid, and any adjustment to your credit agreement are between you
          and our third-party BNPL partner, not NURU — see our{" "}
          <Link href="/legal/bnpl-terms" className="underline underline-offset-2">
            BNPL Credit Terms
          </Link>{" "}
          and contact our partner directly about those.
        </p>
      </LegalSection>

      <LegalSection heading="6. What isn't covered">
        <p>
          Accidental damage, liquid damage, unauthorized repairs, normal wear and tear, and
          cosmetic issues that don&apos;t affect function are not covered by our warranty or
          eligible for return.
        </p>
      </LegalSection>

      <LegalSection heading="7. Contact">
        <p>For returns, refunds, or warranty claims:</p>
        <LegalContact whatsappMessage="Hi! I'd like to start a return/warranty claim for my order." />
      </LegalSection>
    </LegalDocument>
  );
}
