import { FooterLinks } from "./footer-links";

/**
 * Mobile gets a compact links-only block (About/Blog/Support/Search were otherwise unreachable
 * on any page but /account, which used to render its own one-off copy of this — see git history)
 * — desktop keeps the full footer with the brand blurb and copyright line.
 */
export function Footer() {
  return (
    <footer className="border-t border-border-subtle">
      <div className="mx-auto w-full max-w-6xl px-4 py-8 md:hidden">
        <FooterLinks />
      </div>
      <div className="mx-auto hidden w-full max-w-6xl px-4 py-12 md:block">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
          <div>
            <p className="text-lg font-semibold tracking-tight">NURU</p>
            <p className="mt-2 max-w-xs text-sm text-neutral-500">
              NURU is a Kenya-based electronics store offering genuine phones, laptops, audio,
              gaming, cameras, appliances, and more from the world&apos;s top brands. Every order
              ships with manufacturer warranty and fast delivery across Kenya.
            </p>
          </div>
          <div className="sm:col-span-2">
            <FooterLinks />
          </div>
        </div>
        <p className="mt-10 border-t border-border-subtle pt-6 text-sm text-neutral-400">
          &copy; {new Date().getFullYear()} NURU. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
