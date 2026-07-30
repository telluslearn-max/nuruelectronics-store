import type { Metadata } from "next";
import Link from "next/link";
import { LegalContact, LegalDocument, LegalSection } from "@/components/legal-document";
import {
  LEGAL_DOCS_LAST_UPDATED,
  LEGAL_ENTITY_JURISDICTION,
  LEGAL_ENTITY_NAME,
} from "@/lib/legal-entity";

export const metadata: Metadata = {
  title: "BNPL Credit Terms",
  description: `What to know about Buy Now, Pay Later plans referred by ${LEGAL_ENTITY_NAME}.`,
};

export default function BnplTermsPage() {
  return (
    <LegalDocument title="Buy Now, Pay Later (BNPL) Credit Terms" lastUpdated={LEGAL_DOCS_LAST_UPDATED}>
      <p className="rounded-card border border-border-subtle bg-neutral-50 p-4 text-neutral-600">
        This page has not been reviewed by a {LEGAL_ENTITY_JURISDICTION}-qualified lawyer.{" "}
        {LEGAL_ENTITY_NAME} is <strong>not</strong> the credit provider for BNPL — a separate,
        third-party BNPL partner extends and services the credit. Our role is limited to giving you
        the payment plan figures and making sure you understand them before you go on to sign
        anything with our partner. Get this page reviewed before relying on it commercially, and
        confirm it matches your actual referral agreement with your BNPL partner.
      </p>

      <LegalSection heading="1. What BNPL is, and who provides it">
        <p>
          BNPL lets you buy selected products by paying a deposit up front and the remaining
          balance in installments, at a markup, instead of paying the full price at checkout. The
          credit itself is provided by a licensed third-party BNPL partner, not by{" "}
          {LEGAL_ENTITY_NAME}. {LEGAL_ENTITY_NAME}&apos;s role is to show you the plan figures,
          refer you to our BNPL partner, and make the product available for your in-person
          assessment. It is currently
          available on Apple-brand products only; other brands (Infinix, Oppo, Samsung, Tecno,
          Vivo, Xiaomi) are &quot;coming soon&quot; and not yet live.
        </p>
      </LegalSection>

      <LegalSection heading="2. Eligibility">
        <p>To be assessed for BNPL by our partner, you will need to bring:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>A valid national ID.</li>
          <li>3 months of M-Pesa statements.</li>
          <li>Confirmation that you are 18 years or older.</li>
        </ul>
        <p>
          Approval is entirely at our BNPL partner&apos;s discretion and is not guaranteed by{" "}
          {LEGAL_ENTITY_NAME}.
        </p>
      </LegalSection>

      <LegalSection heading="3. How the plans work">
        <p>
          The figures below are the indicative plan {LEGAL_ENTITY_NAME} shows you on this site. In
          both plans, the balance remaining after your deposit is marked up by 50% (you repay 1.5
          times that balance):
        </p>
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
          on the site before you go in for assessment. The 1.5x markup is the cost of the plan —
          you will pay more in total than the item&apos;s listed price. Your final agreement is the
          one you sign in person with our BNPL partner, which governs over any figures shown here.
        </p>
      </LegalSection>

      <LegalSection heading="4. How it actually works">
        <p>
          BNPL is not applied for online and {LEGAL_ENTITY_NAME}{" "}
          does not collect, receive, or store your national ID or M-Pesa statements. After you
          choose a plan, we give you our
          BNPL partner&apos;s contact details and the location where their assessment takes place.
          You must attend in person with your ID and M-Pesa statements so our partner can carry out
          their own credit assessment and, if approved, have you sign their credit agreement
          directly with them. {LEGAL_ENTITY_NAME} arranges for the product to be available at that
          location for the assessment and handover, but takes no part in the credit decision,
          document collection, or the agreement itself.
        </p>
      </LegalSection>

      <LegalSection heading="5. Missed or late payments">
        <p>
          Because the credit is extended and serviced by our BNPL partner, not {LEGAL_ENTITY_NAME},
          any grace periods, late fees, deposit forfeiture, repossession, or credit reporting for
          missed payments are governed entirely by the agreement you sign with our BNPL partner.{" "}
          {LEGAL_ENTITY_NAME} does not process BNPL payments and does not follow up on missed
          installments — contact our BNPL partner directly using the details they gave you at
          signing.
        </p>
      </LegalSection>

      <LegalSection heading="6. Returns on BNPL orders">
        <p>
          If you want to return a product bought via BNPL, we handle the product return itself
          under our{" "}
          <Link href="/legal/refund-policy" className="underline underline-offset-2">
            Refund &amp; Warranty Policy
          </Link>
          . A product return does not automatically change or cancel your credit agreement — your
          deposit, any installments already paid, and any early-settlement terms are governed by
          your agreement with our BNPL partner, so you will need to contact them separately about
          those.
        </p>
      </LegalSection>

      <LegalSection heading="7. Governing law and contact">
        <p>
          This page, and {LEGAL_ENTITY_NAME}&apos;s role in referring you to our BNPL partner, is
          governed by the laws of {LEGAL_ENTITY_JURISDICTION}. For questions about the plan figures
          shown on this site, or about the product itself:
        </p>
        <LegalContact whatsappMessage="Hi! I have a question about a BNPL plan shown on the NURU site." />
        <p>
          For anything about your credit agreement, payments, or account — including missed
          payments — contact our BNPL partner directly using the details they gave you when you
          signed.
        </p>
      </LegalSection>
    </LegalDocument>
  );
}
