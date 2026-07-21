import { FooterLinks } from "./footer-links";

export function Footer() {
  return (
    <footer className="hidden border-t border-border-subtle md:block">
      <div className="mx-auto w-full max-w-6xl px-4 py-12">
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
