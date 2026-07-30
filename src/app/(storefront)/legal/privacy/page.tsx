import type { Metadata } from "next";
import Link from "next/link";
import { LegalDocument, LegalSection } from "@/components/legal-document";
import {
  LEGAL_DOCS_LAST_UPDATED,
  LEGAL_ENTITY_ADDRESS,
  LEGAL_ENTITY_JURISDICTION,
  LEGAL_ENTITY_NAME,
  LEGAL_NOTICE_EMAIL,
  LEGAL_SUPPORT_EMAIL,
} from "@/lib/legal-entity";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: `How ${LEGAL_ENTITY_NAME} collects, uses, and protects your personal data.`,
};

export default function PrivacyPage() {
  return (
    <LegalDocument title="Privacy Policy" lastUpdated={LEGAL_DOCS_LAST_UPDATED}>
      <p>
        {LEGAL_ENTITY_NAME} (&quot;NURU&quot;, &quot;we&quot;, &quot;us&quot;), registered at{" "}
        {LEGAL_ENTITY_ADDRESS}, is the data controller for the personal data described in this
        policy. This policy explains what we collect, why, who we share it with, and how you can
        exercise your rights under the Kenya Data Protection Act, 2019.
      </p>

      <LegalSection heading="1. What we collect">
        <p>Depending on how you interact with the site, we collect:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Order and account data:</strong> name, email, phone number, and, for delivery,
            recipient name, phone, and delivery address — collected through Shopify checkout, our
            Shopify-based customer accounts, or manual/WhatsApp orders.
          </li>
          <li>
            <strong>BNPL application data:</strong> if you apply for Buy Now, Pay Later, you send
            us a national ID and M-Pesa statements directly over WhatsApp as part of the
            application. See our{" "}
            <Link href="/legal/bnpl-terms" className="underline underline-offset-2">
              BNPL Credit Terms
            </Link>{" "}
            for how that specific data is handled.
          </li>
          <li>
            <strong>AI concierge interactions:</strong> text and voice messages you send to our
            shopping concierge. If you are signed in, your conversation history is saved so the
            concierge can refer back to it; if you are not signed in, it is not saved between
            sessions.
          </li>
          <li>
            <strong>Usage/analytics data:</strong> standard website analytics (pages viewed,
            device/browser information) collected via Google Analytics.
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="2. Why we use it">
        <ul className="list-disc space-y-1 pl-5">
          <li>To process and deliver your orders, and to send invoices and receipts.</li>
          <li>To provide customer support and respond to enquiries sent via WhatsApp or email.</li>
          <li>To evaluate and, if approved, administer BNPL applications.</li>
          <li>To operate and improve the AI shopping concierge.</li>
          <li>To understand site usage and improve the shopping experience.</li>
        </ul>
      </LegalSection>

      <LegalSection heading="3. Who we share it with">
        <p>We share personal data with the following service providers, each under their own terms:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Shopify</strong> — order processing, payment capture, and (if you sign in)
            customer accounts.
          </li>
          <li>
            <strong>Google (Vertex AI / Gemini, Firestore, Google Analytics)</strong> — powers the
            AI concierge and stores signed-in users&apos; concierge conversation history; Google
            Analytics collects anonymised usage statistics.
          </li>
          <li>
            <strong>Resend</strong> — delivers transactional emails such as invoices and receipts.
          </li>
        </ul>
        <p>
          We do not sell your personal data. We do not store full payment card details ourselves —
          that is handled entirely by Shopify.
        </p>
      </LegalSection>

      <LegalSection heading="4. Cookies and analytics">
        <p>
          Our site uses Google Analytics cookies to understand how visitors use the site. We do
          not currently show a cookie-consent banner; if this matters for your jurisdiction or
          risk tolerance, you can control cookies through your browser settings.
        </p>
      </LegalSection>

      <LegalSection heading="5. Data retention">
        <p>
          We retain order, invoice, and delivery records for as long as needed for accounting,
          warranty, and legal purposes. Signed-in concierge conversation history is retained until
          you request its deletion or close your account.
        </p>
      </LegalSection>

      <LegalSection heading="6. Your rights">
        <p>
          Under the Kenya Data Protection Act, 2019, you may request access to, correction of, or
          deletion of your personal data, or object to certain processing. To make a request,
          contact us using the details below — we do not currently offer a self-service deletion
          tool, so requests are handled manually.
        </p>
      </LegalSection>

      <LegalSection heading="7. Children">
        <p>
          Our site and BNPL plans are intended for users aged 18 and over. We do not knowingly
          collect personal data from children.
        </p>
      </LegalSection>

      <LegalSection heading="8. Changes to this policy">
        <p>
          We may update this policy from time to time. The &quot;Last updated&quot; date above
          reflects the most recent revision.
        </p>
      </LegalSection>

      <LegalSection heading="9. Contact">
        <p>
          For privacy requests or questions, contact us at{" "}
          {LEGAL_SUPPORT_EMAIL ? (
            <a href={`mailto:${LEGAL_SUPPORT_EMAIL}`} className="underline underline-offset-2">
              {LEGAL_SUPPORT_EMAIL}
            </a>
          ) : (
            LEGAL_NOTICE_EMAIL
          )}
          , or our registered address at {LEGAL_ENTITY_ADDRESS},{" "}
          {LEGAL_ENTITY_JURISDICTION}.
        </p>
      </LegalSection>
    </LegalDocument>
  );
}
