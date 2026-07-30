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
  title: "Terms of Service",
  description: `Terms of Service for the ${LEGAL_ENTITY_NAME} storefront.`,
};

export default function TermsPage() {
  return (
    <LegalDocument title="Terms of Service" lastUpdated={LEGAL_DOCS_LAST_UPDATED}>
      <p>
        These Terms of Service (&quot;Terms&quot;) govern your use of the website and services
        operated by {LEGAL_ENTITY_NAME} (&quot;NURU&quot;, &quot;we&quot;, &quot;us&quot;), a
        company registered in {LEGAL_ENTITY_JURISDICTION} with its registered address at{" "}
        {LEGAL_ENTITY_ADDRESS}. By browsing the site, creating an account, or placing an order,
        you agree to these Terms.
      </p>

      <LegalSection heading="1. Eligibility">
        <p>
          You must be at least 18 years old to place an order or apply for our Buy Now, Pay Later
          (BNPL) plans. By using the site you confirm you meet this requirement.
        </p>
      </LegalSection>

      <LegalSection heading="2. Products, pricing, and availability">
        <p>
          We sell both genuine new electronics and unboxed &quot;ex-UK&quot; units. Ex-UK products
          are clearly labelled as such and are covered by the warranty terms described in our{" "}
          <Link href="/legal/refund-policy" className="underline underline-offset-2">
            Refund &amp; Warranty Policy
          </Link>
          , not the original manufacturer&apos;s warranty. All prices are listed in Kenyan
          Shillings (KES) and are subject to change without notice. Adding a product to your cart
          does not reserve stock; availability is only confirmed once your order is placed.
        </p>
      </LegalSection>

      <LegalSection heading="3. Orders and checkout">
        <p>
          Checkout, payment capture, and order confirmation for online orders are processed by
          Shopify on Shopify&apos;s own checkout pages, under Shopify&apos;s terms of service. We
          do not receive or store your full payment card details. Some orders (including cash,
          M-Pesa, and BNPL applications) are arranged manually with our team over WhatsApp instead
          of through the website checkout; these Terms apply to those orders as well.
        </p>
      </LegalSection>

      <LegalSection heading="4. Buy Now, Pay Later (BNPL)">
        <p>
          BNPL is available on selected products and is a separate credit arrangement between you
          and NURU. Eligibility, deposit amounts, payment schedules, and the cost of the plan are
          set out in full in our{" "}
          <Link href="/legal/bnpl-terms" className="underline underline-offset-2">
            BNPL Credit Terms
          </Link>
          , which you must read and accept separately before applying.
        </p>
      </LegalSection>

      <LegalSection heading="5. AI shopping concierge">
        <p>
          Our site offers an AI-powered concierge (text and voice) to help you find products and
          answer questions. It is provided for convenience only, may produce inaccurate or
          incomplete answers, and does not constitute a binding quote, order confirmation, or
          professional advice. Always confirm pricing, stock, and order details at checkout. See
          our{" "}
          <Link href="/legal/privacy" className="underline underline-offset-2">
            Privacy Policy
          </Link>{" "}
          for how concierge conversations are handled.
        </p>
      </LegalSection>

      <LegalSection heading="6. Accounts">
        <p>
          If you choose to sign in, your account is managed through Shopify&apos;s Customer
          Account system. You are responsible for keeping your login credentials secure and for
          all activity under your account.
        </p>
      </LegalSection>

      <LegalSection heading="7. Returns, refunds, and warranty">
        <p>
          Returns, refunds, and warranty coverage are governed by our{" "}
          <Link href="/legal/refund-policy" className="underline underline-offset-2">
            Refund &amp; Warranty Policy
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection heading="8. Limitation of liability">
        <p>
          To the fullest extent permitted by law, NURU&apos;s total liability arising out of or
          relating to your use of the site or any order is limited to the amount you paid for the
          relevant order. We are not liable for indirect, incidental, or consequential damages,
          for delays or losses caused by third-party services we rely on (including Shopify,
          payment networks, delivery partners, and communication platforms such as WhatsApp), or
          for outcomes of the AI concierge&apos;s responses.
        </p>
      </LegalSection>

      <LegalSection heading="9. Governing law and disputes">
        <p>
          These Terms are governed by the laws of {LEGAL_ENTITY_JURISDICTION}. Any dispute arising
          from these Terms or your use of the site will first be addressed informally by
          contacting us; if unresolved, it will be subject to the exclusive jurisdiction of the
          courts of {LEGAL_ENTITY_JURISDICTION}.
        </p>
      </LegalSection>

      <LegalSection heading="10. Changes to these Terms">
        <p>
          We may update these Terms from time to time. The &quot;Last updated&quot; date above
          reflects the most recent revision. Continued use of the site after changes take effect
          means you accept the updated Terms.
        </p>
      </LegalSection>

      <LegalSection heading="11. Contact">
        <p>
          Questions about these Terms can be sent to{" "}
          {LEGAL_SUPPORT_EMAIL ? (
            <a href={`mailto:${LEGAL_SUPPORT_EMAIL}`} className="underline underline-offset-2">
              {LEGAL_SUPPORT_EMAIL}
            </a>
          ) : (
            LEGAL_NOTICE_EMAIL
          )}
          , or via our{" "}
          <Link href="/support" className="underline underline-offset-2">
            Support page
          </Link>
          .
        </p>
      </LegalSection>
    </LegalDocument>
  );
}
