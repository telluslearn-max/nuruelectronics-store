import type { Metadata } from "next";
import { Faq } from "@/components/faq";
import { HelpActions } from "@/components/help-actions";
import { SearchBox } from "@/components/search-box";

export const metadata: Metadata = {
  title: "Support",
  description: "Get help with orders, delivery, and warranty at NURU.",
};

export default function SupportPage() {
  return (
    <div>
      <div className="mx-auto max-w-xl text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-control bg-accent text-accent-foreground">
          <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 12a8 8 0 1 1 3.5 6.6L4 20l1.4-3.5A7.96 7.96 0 0 1 4 12z" />
          </svg>
        </span>
        <h1 className="mt-4 text-title sm:text-display">Support</h1>
        <p className="mt-2 text-neutral-500">Need help? Start here.</p>
        <div className="mt-8">
          <SearchBox />
        </div>
      </div>

      <div className="mx-auto mt-12 max-w-3xl">
        <HelpActions deliveryHref="/shop#delivery" />
      </div>

      <div className="mx-auto mt-16 max-w-2xl rounded-card bg-neutral-50 p-8 text-center">
        <h2 className="text-lg font-semibold">Our promise</h2>
        <p className="mt-2 text-sm text-neutral-500">
          Every product we sell is checked for authenticity before it ships and comes with
          manufacturer warranty. If anything&apos;s wrong with your order, message us on WhatsApp
          and we&apos;ll sort it out.
        </p>
      </div>

      <div className="mx-auto mt-16 max-w-2xl">
        <h2 className="text-center text-title">Common questions</h2>
        <div className="mt-6">
          <Faq />
        </div>
      </div>
    </div>
  );
}
