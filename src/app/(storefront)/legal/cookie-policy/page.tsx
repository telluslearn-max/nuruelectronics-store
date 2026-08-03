import type { Metadata } from "next";
import Link from "next/link";
import { LegalContact, LegalDocument, LegalSection } from "@/components/legal-document";
import { LEGAL_DOCS_LAST_UPDATED, LEGAL_ENTITY_NAME } from "@/lib/legal-entity";

export const metadata: Metadata = {
  title: "Cookie Policy",
  description: `How ${LEGAL_ENTITY_NAME} uses cookies and similar technologies on this site.`,
};

export default function CookiePolicyPage() {
  return (
    <LegalDocument title="Cookie Policy" lastUpdated={LEGAL_DOCS_LAST_UPDATED}>
      <p>
        This policy explains the cookies and similar technologies we use on this site and why. It
        should be read alongside our{" "}
        <Link href="/legal/privacy" className="underline underline-offset-2">
          Privacy Policy
        </Link>
        .
      </p>

      <LegalSection heading="1. Cookies we use">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Cart cookie</strong> — keeps track of your shopping cart between visits so your
            items aren&apos;t lost. This is essential to shopping on the site.
          </li>
          <li>
            <strong>Admin session cookie</strong> — used only on our internal <code>/admin</code>{" "}
            back office to keep staff signed in. It is never set for customer-facing pages.
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="2. Analytics cookies">
        <p>
          When enabled, we use Google Analytics to understand how the site is used, which sets its
          own cookies in your browser. These are not active unless analytics has been configured
          for the site — if you don&apos;t see analytics scripts loading, no analytics cookies are
          set.
        </p>
      </LegalSection>

      <LegalSection heading="3. How to control cookies">
        <p>
          Most browsers let you block or delete cookies through their settings. Note that blocking
          the cart cookie will prevent adding items to your cart and checking out, since it&apos;s
          required for that functionality to work.
        </p>
      </LegalSection>

      <LegalSection heading="4. Your rights">
        <p>
          As a Kenya-based business, we handle personal data in line with Kenya&apos;s Data
          Protection Act. See our{" "}
          <Link href="/legal/privacy" className="underline underline-offset-2">
            Privacy Policy
          </Link>{" "}
          for details on what we collect and your rights over it.
        </p>
      </LegalSection>

      <LegalSection heading="5. Contact">
        <p>Questions about this Cookie Policy:</p>
        <LegalContact whatsappMessage="Hi! I have a question about your Cookie Policy." />
      </LegalSection>
    </LegalDocument>
  );
}
