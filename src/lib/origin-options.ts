export type OriginOptionInfo = {
  value: string;
  /** Whether repairs are backed by a local East Africa service center, or the unit is imported stock without that backing. */
  serviceRegion: "East Africa" | "Imported";
  years: number | undefined;
  simConfig: string | undefined;
  facetime: string | undefined;
  condition: string | undefined;
};

/**
 * Parses this catalog's origin/warranty option values into the facts a buyer
 * actually cares about. Two brands encode the same East-Africa-vs-imported
 * distinction differently in Shopify:
 *
 * - Apple's "Warranty" option carries duration/SIM-config text (e.g.
 *   "Physical - 1 Year (Non-Active)", "2-Year East Africa") — populates all
 *   fields below.
 * - Samsung's "Source" option is bare ("Africa" / "Dubai") with no
 *   duration/SIM text — only serviceRegion/condition are populated, since
 *   SIM/eSIM/FaceTime claims aren't confirmed for Samsung's imported stock.
 *
 * Structural/regex-based rather than a lookup table, since new products get
 * their own option values added in Shopify over time.
 *
 * Imported stock is sourced from multiple markets (commonly Dubai, but not
 * exclusively) shipment to shipment, so a fixed SIM/FaceTime claim per
 * warranty option would sometimes be wrong — e.g. mainland-China-spec
 * iPhones carry two physical SIM slots with no eSIM and FaceTime Audio
 * permanently disabled, which a "1 physical + eSIM, full FaceTime" claim
 * would miss. Buyers are told this varies and to confirm before ordering if
 * it matters to them, rather than being given a single fact that might not
 * hold.
 */
export function parseOriginOption(value: string, optionName: string): OriginOptionInfo {
  if (optionName.toLowerCase() === "source") {
    const serviceRegion = /africa/i.test(value) ? "East Africa" : "Imported";
    const condition =
      serviceRegion === "Imported"
        ? "Brand new — factory sealed, never opened or activated"
        : undefined;
    return { value, serviceRegion, years: undefined, simConfig: undefined, facetime: undefined, condition };
  }

  const yearsMatch = value.match(/(\d+)\s*-?\s*Year/i);
  const serviceRegion = /East Africa/i.test(value) ? "East Africa" : "Imported";
  const isImported = serviceRegion === "Imported";

  const simConfig = /eSIM Only/i.test(value)
    ? "eSIM only"
    : /Physical/i.test(value)
      ? isImported
        ? "Physical SIM — some imported units are dual-physical-SIM with no eSIM; confirm before ordering"
        : "Physical + eSIM"
      : undefined;

  const facetime = isImported
    ? "Varies by source market — some imports have FaceTime Audio disabled and cannot be changed by region settings; confirm before ordering"
    : "Full support";

  const condition = /Non-Active/i.test(value)
    ? "Brand new — factory sealed, never opened or activated"
    : undefined;

  return {
    value,
    years: yearsMatch ? Number(yearsMatch[1]) : undefined,
    simConfig,
    serviceRegion,
    condition,
    facetime,
  };
}

/**
 * The product's origin/warranty option values, if it has more than one to
 * choose between — whichever of "Warranty" (Apple) or "Source" (Samsung and
 * others) the product actually has.
 */
export function getOriginOptionValues(
  options: { name: string; values: string[] }[],
): { optionName: string; values: string[] } | undefined {
  const originOption = options.find((o) => {
    const name = o.name.toLowerCase();
    return name === "warranty" || name === "source";
  });
  if (!originOption || originOption.values.length < 2) return undefined;
  return { optionName: originOption.name, values: originOption.values };
}

/**
 * Whether any Warranty option value is eSIM-only — checked independently of
 * getOriginOptionValues, since a phone like the eSIM-only iPhone Air has
 * just one Warranty value (nothing to compare) but still needs the eSIM
 * setup guide. Scoped to the "Warranty" option only — Samsung's "Source"
 * option never carries a SIM/eSIM claim.
 */
export function hasEsimOnlyWarranty(options: { name: string; values: string[] }[]): boolean {
  const warrantyOption = options.find((o) => o.name.toLowerCase() === "warranty");
  return warrantyOption?.values.some((v) => /esim/i.test(v)) ?? false;
}
