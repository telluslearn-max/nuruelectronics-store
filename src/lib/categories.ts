export type Category = {
  slug: string;
  label: string;
  query: string;
  blurb: string;
  art: ArtKind;
  series?: { slug: string; label: string; query: string }[];
};

export type ArtKind = "phone" | "tablet" | "buds" | "watch" | "charger" | "generic";

export const categories: Category[] = [
  {
    slug: "phones",
    label: "Phones",
    query: "product_type:Smartphones",
    blurb: "Samsung Galaxy smartphones, from foldables to the A series.",
    art: "phone",
    series: [
      { slug: "foldables", label: "Foldables", query: "tag:collection-foldables" },
      { slug: "s26", label: "Galaxy S26", query: "tag:collection-galaxy-s26-series" },
      { slug: "s25", label: "Galaxy S25", query: "tag:collection-galaxy-s25-series" },
      { slug: "a-series", label: "Galaxy A", query: "tag:collection-galaxy-a-series" },
    ],
  },
  {
    slug: "tablets",
    label: "Tablets",
    query: "product_type:Tablets",
    blurb: "Galaxy Tab lineup for work and play.",
    art: "tablet",
  },
  {
    slug: "audio",
    label: "Audio",
    query: "product_type:Audio",
    blurb: "Galaxy Buds for music, calls, and everything between.",
    art: "buds",
  },
  {
    slug: "wearables",
    label: "Wearables",
    query: "product_type:Wearables",
    blurb: "Galaxy Watch for health, fitness, and time.",
    art: "watch",
  },
  {
    slug: "chargers",
    label: "Chargers",
    query: "product_type:Chargers",
    blurb: "Fast chargers and wireless charging pads.",
    art: "charger",
  },
  {
    slug: "accessories",
    label: "Accessories",
    query: "product_type:Accessories",
    blurb: "Keyboard covers, SmartTags, and more.",
    art: "generic",
  },
];

export function getCategory(slug: string): Category | undefined {
  return categories.find((c) => c.slug === slug);
}

export function categoryForProductType(productType: string): Category | undefined {
  const map: Record<string, string> = {
    Smartphones: "phones",
    Tablets: "tablets",
    Audio: "audio",
    Wearables: "wearables",
    Chargers: "chargers",
    Accessories: "accessories",
  };
  const slug = map[productType];
  return slug ? getCategory(slug) : undefined;
}
