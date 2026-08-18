"use client";

import { FooterLinks } from "./footer-links";
import { useMediaQuery } from "./use-media-query";

/** Matches Tailwind's `md` breakpoint, which is what gates the desktop vs. mobile footer block below. */
const IS_DESKTOP_QUERY = "(min-width: 768px)";

/**
 * Mobile gets a compact links-only block (About/Blog/Support/Search were otherwise unreachable
 * on any page but /account, which used to render its own one-off copy of this — see git history)
 * — desktop keeps the full footer with the brand blurb and copyright line. Each block renders its
 * own copy of every footer link, so a screen reader user could otherwise land on the same link
 * twice (audit finding L2) — aria-hidden on whichever block the current breakpoint doesn't show
 * keeps assistive tech to a single copy.
 */
export function Footer() {
  const isDesktop = useMediaQuery(IS_DESKTOP_QUERY);

  return (
    <footer className="border-t border-border-subtle">
      <div className="mx-auto w-full max-w-6xl px-4 py-8 md:hidden" aria-hidden={isDesktop}>
        <FooterLinks />
      </div>
      <div className="mx-auto hidden w-full max-w-6xl px-4 py-12 md:block" aria-hidden={!isDesktop}>
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
