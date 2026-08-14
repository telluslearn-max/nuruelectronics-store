import type { Metadata } from "next";
import { requireAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { isReloadlyConfigured, searchGiftCardProducts } from "@/lib/reloadly/client";
import {
  createGiftCardMapping,
  createGiftCardOffering,
  deleteGiftCardMapping,
  deleteGiftCardOffering,
  updateGiftCardOffering,
} from "@/lib/gift-card-actions";
import { FeedbackBanner } from "@/components/admin/feedback-banner";
import { SubmitButton } from "@/components/admin/submit-button";
import { ConfirmSubmitButton } from "@/components/admin/confirm-submit-button";

export const metadata: Metadata = { title: "Gift Cards" };

const inputClass =
  "w-full rounded-control border border-border-subtle px-3 py-2 text-sm outline-none focus:border-foreground";
const primaryButtonClass =
  "rounded-control bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90";

export default async function AdminGiftCardsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; success?: string; error?: string }>;
}) {
  await requireAdminSession();
  const { q, success, error } = await searchParams;

  const [mappings, offerings] = await Promise.all([
    prisma.giftCardProductMapping.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.giftCardOffering.findMany({ orderBy: { createdAt: "desc" } }),
  ]);
  const offeredProductIds = new Set(offerings.map((offering) => offering.reloadlyProductId));

  if (!isReloadlyConfigured) {
    return (
      <div>
        <h2 className="text-lg font-medium">Gift Cards</h2>
        <FeedbackBanner success={success} error={error} />
        <p className="mt-6 text-sm text-neutral-500">
          Set RELOADLY_CLIENT_ID and RELOADLY_CLIENT_SECRET to map Shopify gift card variants to Reloadly products and
          fulfill them automatically from an order.
        </p>
      </div>
    );
  }

  let searchResults: Awaited<ReturnType<typeof searchGiftCardProducts>> = [];
  let searchError: string | null = null;
  if (q?.trim()) {
    try {
      searchResults = await searchGiftCardProducts({ productName: q.trim(), size: 15 });
    } catch (err) {
      searchError = err instanceof Error ? err.message : "Unknown error";
    }
  }

  return (
    <div>
      <h2 className="text-lg font-medium">Gift Cards</h2>
      <p className="mt-1 text-sm text-neutral-500">
        Map a Shopify gift card variant to a Reloadly catalog product (e.g. a PSN Store card) so it can be fulfilled
        with one click from the order page.
      </p>
      <FeedbackBanner success={success} error={error} />

      <section className="mt-8 rounded-card border border-border-subtle p-5">
        <h3 className="font-medium">Find a Reloadly product</h3>
        <form method="GET" action="/admin/gift-cards" className="mt-3 flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-xs text-neutral-500">Product name</label>
            <input type="text" name="q" defaultValue={q ?? ""} placeholder="PlayStation Store…" className={inputClass} />
          </div>
          <button type="submit" className="rounded-control border border-border-subtle px-4 py-2 text-sm font-medium hover:border-foreground">
            Search
          </button>
        </form>

        {searchError && <p className="mt-4 text-sm text-red-600">Couldn&apos;t search Reloadly: {searchError}</p>}

        {q?.trim() && !searchError && (
          <ul className="mt-4 space-y-4">
            {searchResults.map((product) => (
              <li key={product.productId} className="rounded-card border border-border-subtle p-4 text-sm">
                <p className="font-medium">
                  {product.productName} <span className="font-normal text-neutral-500">· {product.country.name}</span>
                </p>
                <p className="mt-1 text-neutral-500">
                  Reloadly product #{product.productId} ·{" "}
                  {product.denominationType === "FIXED"
                    ? `Fixed: ${product.fixedRecipientDenominations.join(", ")} ${product.recipientCurrencyCode}`
                    : `Range: ${product.minRecipientDenomination}–${product.maxRecipientDenomination} ${product.recipientCurrencyCode}`}
                </p>
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm font-medium">Map to a Shopify variant</summary>
                  <form action={createGiftCardMapping} className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <input type="hidden" name="reloadlyProductId" value={product.productId} />
                    <input type="hidden" name="reloadlyProductName" value={product.productName} />
                    <input type="hidden" name="reloadlyCountryCode" value={product.country.isoName} />
                    <div>
                      <label className="block text-xs text-neutral-500">Shopify variant ID</label>
                      <input type="text" name="shopifyVariantId" required placeholder="gid://shopify/ProductVariant/…" className={inputClass} />
                    </div>
                    <div>
                      <label className="block text-xs text-neutral-500">Shopify product title</label>
                      <input type="text" name="shopifyProductTitle" required placeholder="PSN Gift Card $25 (US)" className={inputClass} />
                    </div>
                    <div className="sm:col-span-2">
                      <SubmitButton className={primaryButtonClass} pendingText="Saving…">
                        Save mapping
                      </SubmitButton>
                    </div>
                  </form>
                </details>

                {offeredProductIds.has(product.productId) ? (
                  <p className="mt-3 text-neutral-500">Already published to the storefront.</p>
                ) : (
                  <details className="mt-3" open>
                    <summary className="cursor-pointer text-sm font-medium">Publish to storefront</summary>
                    <form action={createGiftCardOffering} className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <input type="hidden" name="reloadlyProductId" value={product.productId} />
                      <input type="hidden" name="reloadlyCountryCode" value={product.country.isoName} />
                      <input type="hidden" name="reloadlyCurrencyCode" value={product.recipientCurrencyCode} />
                      <input type="hidden" name="denominationType" value={product.denominationType} />
                      <input type="hidden" name="fixedDenominations" value={product.fixedRecipientDenominations.join(",")} />
                      <input type="hidden" name="minDenomination" value={product.minRecipientDenomination ?? ""} />
                      <input type="hidden" name="maxDenomination" value={product.maxRecipientDenomination ?? ""} />
                      <div>
                        <label className="block text-xs text-neutral-500">Storefront display name</label>
                        <input type="text" name="displayName" required defaultValue={product.productName} className={inputClass} />
                      </div>
                      <div>
                        <label className="block text-xs text-neutral-500">Category</label>
                        <select name="category" defaultValue="other" className={inputClass}>
                          <option value="playstation">PlayStation</option>
                          <option value="xbox">Xbox</option>
                          <option value="nintendo">Nintendo</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-neutral-500">Markup % (minimum 20)</label>
                        <input type="number" name="markupPercent" min={20} step={1} defaultValue={20} className={inputClass} />
                      </div>
                      <div className="flex items-end sm:col-span-2">
                        <SubmitButton className={primaryButtonClass} pendingText="Publishing…">
                          Publish to storefront
                        </SubmitButton>
                      </div>
                    </form>
                  </details>
                )}
              </li>
            ))}
            {searchResults.length === 0 && <p className="text-neutral-500">No Reloadly products matched &ldquo;{q}&rdquo;.</p>}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h3 className="text-sm font-medium text-neutral-500">Mappings</h3>
        <ul className="mt-3 space-y-3">
          {mappings.map((mapping) => (
            <li key={mapping.id} className="rounded-card border border-border-subtle p-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span>
                  <span className="block font-medium">{mapping.shopifyProductTitle}</span>
                  <span className="mt-1 block text-neutral-500">
                    Variant {mapping.shopifyVariantId} → {mapping.reloadlyProductName} ({mapping.reloadlyCountryCode})
                  </span>
                </span>
                <form action={deleteGiftCardMapping.bind(null, mapping.id)}>
                  <ConfirmSubmitButton
                    confirmMessage={`Remove the Reloadly mapping for "${mapping.shopifyProductTitle}"?`}
                    className="underline hover:text-foreground"
                  >
                    Remove
                  </ConfirmSubmitButton>
                </form>
              </div>
            </li>
          ))}
          {mappings.length === 0 && <p className="text-sm text-neutral-500">No mappings yet — search above to add one.</p>}
        </ul>
      </section>

      <section className="mt-8">
        <h3 className="text-sm font-medium text-neutral-500">Storefront offerings</h3>
        <p className="mt-1 text-sm text-neutral-500">
          Published offerings are what customers see and pay for via M-Pesa on the storefront.
        </p>
        <ul className="mt-3 space-y-3">
          {offerings.map((offering) => (
            <li key={offering.id} className="rounded-card border border-border-subtle p-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span>
                  <span className="block font-medium">
                    {offering.displayName}{" "}
                    <span className="font-normal text-neutral-500">
                      · {offering.category} · {offering.published ? "Published" : "Unpublished"}
                    </span>
                  </span>
                  <span className="mt-1 block text-neutral-500">
                    Reloadly product #{offering.reloadlyProductId} ({offering.reloadlyCountryCode}) · Markup {offering.markupPercent.toString()}%
                  </span>
                </span>
                <form action={deleteGiftCardOffering.bind(null, offering.id)}>
                  <ConfirmSubmitButton
                    confirmMessage={`Remove the storefront offering "${offering.displayName}"?`}
                    className="underline hover:text-foreground"
                  >
                    Remove
                  </ConfirmSubmitButton>
                </form>
              </div>
              <details className="mt-3">
                <summary className="cursor-pointer font-medium">Edit</summary>
                <form
                  action={updateGiftCardOffering.bind(null, offering.id)}
                  className="mt-3 flex flex-wrap items-end gap-3"
                >
                  <div>
                    <label className="block text-xs text-neutral-500">Markup % (minimum 20)</label>
                    <input
                      type="number"
                      name="markupPercent"
                      min={20}
                      step={1}
                      defaultValue={offering.markupPercent.toString()}
                      className={inputClass}
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="published" defaultChecked={offering.published} className="h-4 w-4" />
                    Published
                  </label>
                  <SubmitButton className={primaryButtonClass} pendingText="Saving…">
                    Save
                  </SubmitButton>
                </form>
              </details>
            </li>
          ))}
          {offerings.length === 0 && (
            <p className="text-sm text-neutral-500">No storefront offerings yet — search above and publish one.</p>
          )}
        </ul>
      </section>
    </div>
  );
}
