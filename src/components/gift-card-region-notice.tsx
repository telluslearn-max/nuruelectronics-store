/**
 * Digital gift cards only redeem on an account registered to the region
 * they were issued for — this explains that plainly on the PDP, in addition
 * to the "US Store Only"-style badge (src/lib/badges.ts) shown while
 * browsing. Renders only when the product actually has a `region` spec.
 */
export function GiftCardRegionNotice({ region }: { region: string }) {
  return (
    <div className="mt-4 rounded-card border border-border-subtle p-4">
      <p className="text-sm font-medium">{region} Store Only</p>
      <p className="mt-1 text-xs text-neutral-500">
        {`This code only redeems on an account registered to the ${region} store. Check your account's region before ordering — it won't work on any other region.`}
      </p>
    </div>
  );
}
