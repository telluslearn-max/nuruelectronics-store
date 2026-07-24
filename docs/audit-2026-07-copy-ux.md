# NURU Store — Website Copy & UX Audit

**Date:** 2026-07-24
**Scope:** Core storefront journey (home → shop → category → product → cart → Shopify-hosted checkout), Support/About/Contact, the Ex-UK swipe sub-app, an accessibility pass across the storefront, and the Concierge AI chat widget.
**Out of scope:** `src/app/admin/*` (internal back-office, not customer-facing).

## 1. Executive summary

The storefront's copy is disciplined and consistent where it matters most: the same trust badges ("100% Genuine Products," "Manufacturer Warranty," "Fast Nairobi Delivery," "Countrywide Shipping") and the same VAT-disclosure pattern ("excl. VAT" + tooltip) appear identically on the homepage, category pages, product pages, and the cart drawer. The Concierge AI widget's system prompt is well-written and on-brand ("knowledgeable, friendly in-store staff member").

The single biggest issue is structural, not stylistic: the homepage's `<h1>` was the title of whichever product happened to be the most expensive in the catalog at request time, rather than a stable value-proposition headline — a problem for both SEO (no consistent keyword-bearing headline) and screen-reader users (who heard a phone model name, not "NURU," as the page's main heading). This has been fixed in this pass (see §6).

Everything else found is either a small, safe copy inconsistency (fixed in this pass) or a gap that needs a human decision or new content rather than a mechanical fix (documented in §7, not fixed here).

## 2. Scope & method

This audit was performed by reading the site's source (JSX/TSX, string literals, ARIA attributes) and rendering key pages via the local dev server (with Shopify unconfigured, so product data comes from the dev mock catalog — layout/markup structure is unaffected by this, but visible product names/prices in this environment are not real). **No testing was done with an actual screen reader, keyboard-only navigation, or a real Shopify-backed environment.** Accessibility findings below are code-level (markup/ARIA correctness), not verified with assistive technology — treat them as a strong starting point, not a substitute for a manual a11y pass before a release that changes interactive components.

## 3. Prioritized findings

| ID | Area | Finding | Severity | Effort | File:line | Fixed? |
|----|------|---------|----------|--------|-----------|--------|
| F1 | Home / SEO / a11y | Homepage `<h1>` was a dynamic product title, not a static headline | High | Low | `src/app/(storefront)/page.tsx:100` | **Y** |
| F2 | Support / a11y | WhatsApp help card used a different verb ("Chat"/"Start chat") than the rest of the site ("Message") | Low | Low | `src/components/help-actions.tsx:52,58` | **Y** |
| F3 | PDP / a11y | Product option/swatch buttons didn't expose selection state to assistive tech | Medium | Low | `src/components/product-options.tsx` (~line 191) | **Y** |
| F4 | About | About page has no founding story, mission, or team content — just the footer blurb + badges + category grid | Medium | High (needs authored content) | `src/app/(storefront)/about/page.tsx` | N |
| F5 | Ex-UK | Ex-UK's "swipe right to love, left to pass" tone breaks from the plain/factual voice used everywhere else, including the Concierge's own description of Ex-UK units | Medium | Needs a decision | `src/app/ex-uk/page.tsx:9`, `src/components/ex-uk/swipe-card.tsx:159` | N |
| F6 | Cart | No user-facing error copy if add/remove/update-quantity fails server-side — falls through to the generic app error boundary | Medium | Medium (needs try/catch + UI) | `src/lib/actions.ts:46-70` | N |
| F7 | Support/Contact | "Contact us" (footer) and the WhatsApp CTA both silently disappear if their env vars are unset, with no fallback messaging | Low–Medium (env-dependent) | N/A (verify config) | `.env.local.example`, `src/components/help-actions.tsx`, `src/components/footer-links.tsx` | N |

## 4. Detailed findings by journey stage

### Homepage
- Tagline "Genuine electronics. Delivered fast." is used consistently as the site's eyebrow/kicker across Home, About, and Support — good.
- **F1 (fixed):** the `<h1>` rendered whatever product the homepage's "hero" logic picked (the top-priced item), so it changed with inventory and had no relationship to the page's actual topic ("NURU"). A screen-reader user landing on the page heard a phone model as the main heading instead of a value proposition.
- CTAs ("Shop now", "Explore phones", "Explore the full shop") are clear and action-oriented throughout.

### Shop / Category / Product detail
- "Showing N products" listing copy correctly handles singular/plural.
- VAT disclosure ("excl. VAT" tooltip: "VAT is calculated and added at checkout.") appears consistently on both the PDP buy box and the cart subtotal — a good pattern, worth preserving as the standard for any future price display.
- Auto-generated product FAQs ("Is this genuine and covered by warranty?", "How fast can I get this delivered?", etc.) are consistent in tone with the site-wide Support FAQ.
- **F3 (fixed):** option/swatch buttons (color, storage, etc.) relied purely on visual styling (border/background) to show which value was selected; the `disabled` attribute already covered unavailable options correctly, but selection state wasn't exposed to assistive technology. Added `aria-pressed`.
- **F2 (fixed):** three different verbs were used for the same WhatsApp channel across the site — "Order via WhatsApp" (PDP, ordering a specific item), "Chat with us"/"Start chat" (Support/Shop help card), "Message us on WhatsApp" (FAQ). "Order via WhatsApp" is intentionally distinct (it's a more specific action — placing an order, not asking a question), so it was left as-is. The generic help card was aligned to "Message us on WhatsApp" / "Message us," matching the FAQ, so there are now exactly two verbs used deliberately for two different actions rather than three used inconsistently for one.

### Cart & checkout handoff
- Cart drawer copy is clean and minimal: "Your Cart," "Your cart is empty." + "Continue shopping," clear quantity controls, "Checkout" hands off directly to Shopify's hosted checkout.
- **F6 (not fixed):** `addItem`/`removeItem`/`updateItemQuantity` (`src/lib/actions.ts:46-70`) have no error handling — a failed cart action isn't caught and shown to the user with a specific message; it would only surface via the generic app-wide error boundary ("Something went wrong" / "Try again" in `src/app/error.tsx`), which doesn't tell the shopper what happened or that their cart is unaffected. Fixing this needs a try/catch plus a UI decision (inline toast? drawer banner?), not a copy-only edit, so it's documented here as a recommendation rather than implemented in this pass. Suggested copy once implemented: *"Couldn't update your cart — please try again."*

### Support / About / Contact
- Support page's "Our promise" block and the FAQ are consistent, specific, and reassuring (genuine products, manufacturer warranty, WhatsApp escalation).
- **F4 (not fixed):** the About page is titled "About NURU" but contains no actual narrative — it repeats the footer blurb, trust badges, and the category grid already shown elsewhere on the site. This isn't a defect to patch mechanically; it needs a human to write real company story/mission content. Flagged as a recommendation, not fabricated here.
- **F7 (not fixed):** "Contact us" (footer, `mailto:` link) and the WhatsApp help card both depend on `NEXT_PUBLIC_SUPPORT_EMAIL` / `NEXT_PUBLIC_WHATSAPP_NUMBER` being set, and simply don't render if unset — there's no fallback message telling the shopper "support info coming soon" or similar. This audit could not confirm what's actually configured in the production deployment; recommend verifying these are set live, since an unset var would mean the site has **no visible way to contact support at all**.

### Ex-UK swipe sub-app
- **F5 (not fixed):** `src/app/ex-uk/page.tsx:9`'s meta description and the swipe card's `aria-label` (`src/components/ex-uk/swipe-card.tsx:159`) both read "Unboxed ex-UK units at a lower price, every one covered by a 1-year warranty. Swipe right to love, left to pass." — a distinctly playful, dating-app-style voice. Notably, this is inconsistent even within the product itself: the Concierge AI's own system prompt (`src/lib/concierge/system-prompt.ts:39-40`) describes the same Ex-UK inventory in the site's normal plain/factual voice ("unboxed, Ex-UK-imported units... each still covered by a 1-year warranty"), with no playful framing at all. This looks like it could be an intentional sub-brand differentiator for a standalone discovery experience, or it could be an unreviewed tone drift — worth a stakeholder call rather than a unilateral rewrite, so it's documented as an open question (§8) rather than changed here.

### Concierge AI widget
- The system prompt (`src/lib/concierge/system-prompt.ts`) is well-scoped and on-brand: instructs the model to speak like "a knowledgeable, friendly in-store staff member — not a scripted bot," grounds it in the real catalog, and has explicit hard rules against inventing prices, specs, or IDs. No copy changes recommended here.
- The FAB's accessible name, "Talk to an expert" (`concierge-fab.tsx:27`), is a reasonable, human framing consistent with the "in-store staff member" positioning used in the system prompt.

## 5. Accessibility appendix

**Positives** (worth preserving as the site's standard going forward):
- Skip link ("Skip to content") targeting `#main` (`src/app/(storefront)/layout.tsx:37-42`).
- Product images always get an `alt` attribute, falling back to the product title when catalog data has none (`src/components/product-media.tsx:145-154`); purely decorative SVG art is correctly `aria-hidden="true"`.
- Cart drawer has proper dialog semantics: `role="dialog"`, `aria-modal="true"`, `aria-label="Shopping cart"`, focus moves to the close button on open, Escape closes it.
- Nav mega-menu uses `aria-expanded`, `aria-haspopup`, `aria-controls`, `role="menu"`/`role="menuitem"` correctly.
- Search box implements the combobox pattern correctly (`role="combobox"`, `aria-expanded`, `aria-controls`, `aria-activedescendant`, results as `role="listbox"`/`role="option"`).
- Breadcrumb has `aria-label="Breadcrumb"` and marks the current page with `aria-current="page"`.
- Heading hierarchy is generally well-formed — one `<h1>` per page, consistent `<h2>` section headings via the shared `SectionHeading` component — and product specs use semantic `<dl>/<dt>/<dd>`.

**Gaps:**
- F1 and F3 above (both fixed in this pass).
- Icon-only close/dismiss buttons (cart drawer close, announcement bar dismiss) render a raw `×` glyph but already carry a correct `aria-label` ("Close cart," "Dismiss announcement"), so the accessible name is computed correctly regardless of the glyph. This is a cosmetic follow-up at most (wrapping the glyph in `aria-hidden`, or swapping for an SVG) — not a functional accessibility bug, and not changed in this pass.

## 6. Quick-wins shipped in this pass

| # | Change | File | Before | After |
|---|--------|------|--------|-------|
| 1 | Static, screen-reader-visible `<h1>` added; the previous dynamic-product `<h1>` demoted to `<h2>` (no visual change) | `src/app/(storefront)/page.tsx` | `<h1 class="mt-2 text-title sm:text-display">{hero.title}</h1>` (e.g. renders "iPhone 17 Pro") | `<h1 class="sr-only">NURU — genuine electronics, delivered fast across Kenya</h1>` + `<h2 class="mt-2 text-title sm:text-display">{hero.title}</h2>` |
| 2 | WhatsApp help card copy aligned to the "message" verb used site-wide | `src/components/help-actions.tsx` | Heading "Chat with us", body "Message us on WhatsApp for advice before you buy.", CTA "Start chat" | Heading "Message us on WhatsApp", body "Get advice on WhatsApp before you buy.", CTA "Message us" |
| 3 | Selection state on product option/swatch buttons exposed to assistive tech | `src/components/product-options.tsx` | Selected state shown only via border/background color | Added `aria-pressed={isSelected}` |

All three verified via `npx eslint` (no new warnings) and by rendering the affected pages (`/`, `/support`, a product detail page) through the local dev server.

## 7. Recommendations not implemented (need a human decision or new content)

1. **Write real About-page content** (F4) — founding story, mission, or team info. No content was fabricated for this audit; the page currently just repeats copy shown elsewhere on the site.
2. **Decide on Ex-UK's tone** (F5) — confirm whether the swipe app's playful "swipe right to love" voice is an intentional sub-brand choice, given it doesn't match the plain/factual voice used everywhere else on the site, including the Concierge's own description of the same Ex-UK inventory.
3. **Add cart error-state copy** (F6) — needs error handling added to `src/lib/actions.ts`'s cart mutations plus a UI decision for where the message surfaces (inline in the drawer vs. a toast). Suggested copy: *"Couldn't update your cart — please try again."*
4. **Verify `NEXT_PUBLIC_SUPPORT_EMAIL` and `NEXT_PUBLIC_WHATSAPP_NUMBER` are set in production** (F7) — if either is unset live, that support channel is completely invisible to shoppers with no fallback messaging. This audit was run without either configured and could not confirm production state.

## 8. Open questions / risks

- Is Ex-UK's tone (§4, "Ex-UK swipe sub-app") an intentional, reviewed brand decision, or did it drift unreviewed from the rest of the site's voice?
- Are the support-contact env vars (`NEXT_PUBLIC_SUPPORT_EMAIL`, `NEXT_PUBLIC_WHATSAPP_NUMBER`) actually populated in the live deployment? If not, the site currently has no visible customer-support channel at all.
- This audit is code-level only — no live screen-reader, keyboard-only, or real-Shopify-backend testing was performed. Recommend a manual a11y pass (e.g. VoiceOver/NVDA + keyboard-only) before shipping any further interactive-component changes.
