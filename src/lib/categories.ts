export type Category = {
  slug: string;
  label: string;
  types: string[];
  query: string;
  blurb: string;
  art: ArtKind;
  groups?: { slug: string; label: string; query: string }[];
};

export type ArtKind =
  | "phone"
  | "tablet"
  | "buds"
  | "watch"
  | "charger"
  | "laptop"
  | "gaming"
  | "camera"
  | "appliance"
  | "generic";

// Shopify search syntax requires quoting field values that contain spaces or
// special characters (e.g. product_type:"Hubs & Docks") — build queries
// through this helper rather than hand-writing raw strings.
function productTypeQuery(types: string[]): string {
  return types.map((t) => `product_type:${JSON.stringify(t)}`).join(" OR ");
}

/**
 * Full category membership (every type in `category.types`) as a query — distinct from
 * `category.query`, which some categories narrow to a curated subset for their default browse
 * view (e.g. Cameras excludes Streaming Devices/Media Players from its default listing, see the
 * comment on that entry below, while still routing those product types here via `types`). Use
 * this, not `category.query`, for "does this product belong to this category" purposes — e.g. a
 * "similar products" rail or a brand's category tile — where the answer should follow full
 * membership, not the curated default-view subset.
 */
export function categoryMembershipQuery(category: Category): string {
  return productTypeQuery(category.types);
}

export const categories: Category[] = [
  {
    slug: "phones",
    label: "Phones",
    types: ["Smartphones"],
    query: productTypeQuery(["Smartphones"]),
    // Redmi (9 units) outsells Google (5 units) in this catalog, so it's
    // named ahead of Google here despite Google being the more globally
    // recognized brand.
    blurb: "Smartphones from Samsung, Apple, Redmi, Google, and more.",
    art: "phone",
    groups: [
      { slug: "foldables", label: "Foldables", query: "tag:collection-foldables" },
      { slug: "s26", label: "Galaxy S26", query: "tag:collection-galaxy-s26-series" },
      { slug: "s25", label: "Galaxy S25", query: "tag:collection-galaxy-s25-series" },
      { slug: "a-series", label: "Galaxy A", query: "tag:collection-galaxy-a-series" },
      { slug: "iphone-17", label: "iPhone 17", query: "tag:collection-iphone-17-series" },
      { slug: "legacy-iphone", label: "Legacy iPhone", query: "tag:collection-legacy-iphones" },
      {
        // Redmi/Xiaomi also make tablets tagged with the same collection
        // tags, so this is intersected with Smartphones — otherwise "Redmi &
        // Xiaomi" on the Phones page would also surface Redmi/Xiaomi tablets.
        slug: "redmi-xiaomi",
        label: "Redmi & Xiaomi",
        query: `(tag:collection-redmi OR tag:collection-xiaomi) AND ${productTypeQuery(["Smartphones"])}`,
      },
      { slug: "pixel", label: "Google Pixel", query: "tag:collection-google-pixel" },
      { slug: "nothing", label: "Nothing", query: "tag:collection-nothing" },
      { slug: "oneplus", label: "OnePlus", query: "tag:collection-oneplus" },
    ],
  },
  {
    slug: "tablets",
    label: "Tablets",
    types: ["Tablets", "Tablet Accessories", "E-Readers"],
    query: productTypeQuery(["Tablets", "Tablet Accessories", "E-Readers"]),
    blurb: "Tablets and e-readers for work, study, and play.",
    art: "tablet",
    groups: [
      { slug: "galaxy-tab", label: "Galaxy Tab", query: "tag:collection-tablets" },
      { slug: "surface", label: "Surface", query: "tag:collection-microsoft-surface" },
      { slug: "e-readers", label: "E-Readers", query: productTypeQuery(["E-Readers"]) },
      {
        slug: "accessories",
        label: "Tablet Accessories",
        query: productTypeQuery(["Tablet Accessories"]),
      },
    ],
  },
  {
    slug: "computers",
    label: "Computers",
    types: [
      "Laptops",
      "Desktops",
      "Displays",
      "Computer Accessories",
      "Hubs & Docks",
      "Laptop Stands",
    ],
    query: productTypeQuery([
      "Laptops",
      "Desktops",
      "Displays",
      "Computer Accessories",
      "Hubs & Docks",
      "Laptop Stands",
    ]),
    blurb: "Laptops, desktops, and everything for your desk.",
    art: "laptop",
    groups: [
      { slug: "mac", label: "Mac", query: "tag:collection-mac" },
      { slug: "surface", label: "Surface", query: "tag:collection-microsoft-surface" },
      { slug: "displays", label: "Displays & Monitors", query: productTypeQuery(["Displays"]) },
      {
        slug: "docks-hubs",
        label: "Docks & Hubs",
        query: productTypeQuery(["Hubs & Docks"]),
      },
      {
        slug: "laptop-stands",
        label: "Laptop Stands",
        query: productTypeQuery(["Laptop Stands"]),
      },
    ],
  },
  {
    slug: "audio",
    label: "Audio",
    // Gaming Audio stays here rather than under Gaming: gaming headsets are
    // still fundamentally listening devices, and keeps Gaming lean
    // (consoles/peripherals only). Sound Bars stay here rather than under
    // Appliances for the same reason — still an audio product first.
    types: [
      "Audio",
      "Audio Accessories",
      "Earbuds",
      "Headphones",
      "Speakers",
      "Smart Speakers",
      "Sound Bars",
      "Wearable Audio",
      "Audio Recorders",
      "Microphones",
      "Gaming Audio",
    ],
    query: productTypeQuery([
      "Audio",
      "Audio Accessories",
      "Earbuds",
      "Headphones",
      "Speakers",
      "Smart Speakers",
      "Sound Bars",
      "Wearable Audio",
      "Audio Recorders",
      "Microphones",
      "Gaming Audio",
    ]),
    blurb: "Earbuds, headphones, and speakers for music, calls, and everything between.",
    art: "buds",
    groups: [
      {
        slug: "earbuds-headphones",
        label: "Earbuds & Headphones",
        query: productTypeQuery(["Earbuds", "Headphones", "Wearable Audio"]),
      },
      {
        slug: "speakers",
        label: "Speakers & Sound Bars",
        query: productTypeQuery(["Speakers", "Smart Speakers", "Sound Bars"]),
      },
      {
        slug: "microphones",
        label: "Microphones & Recorders",
        query: productTypeQuery(["Microphones", "Audio Recorders"]),
      },
      { slug: "gaming-audio", label: "Gaming Audio", query: productTypeQuery(["Gaming Audio"]) },
      {
        slug: "accessories",
        label: "Audio Accessories",
        query: productTypeQuery(["Audio", "Audio Accessories"]),
      },
      // Top 5 audio brands by volume get their own chip; smaller brands
      // (Marshall, Beats, Sonos, LG, Denon, Hollyland) stay reachable via
      // browsing/search rather than adding an oversized filter list.
      { slug: "jbl", label: "JBL", query: "tag:collection-jbl" },
      { slug: "boya", label: "Boya", query: "tag:collection-boya" },
      { slug: "bose", label: "Bose", query: "tag:collection-bose" },
      { slug: "rode", label: "Rode", query: "tag:collection-rode" },
      { slug: "shokz", label: "Shokz", query: "tag:collection-shokz" },
    ],
  },
  {
    slug: "wearables",
    label: "Wearables",
    // Smart Glasses go here rather than under Cameras, despite having a
    // camera (Ray-Ban Meta) — matches shopper mental model (worn on body).
    types: ["Wearables", "Smart Glasses"],
    query: productTypeQuery(["Wearables", "Smart Glasses"]),
    blurb: "Smartwatches, fitness trackers, and smart glasses.",
    art: "watch",
    groups: [
      { slug: "galaxy-watch", label: "Galaxy Watch", query: "tag:collection-wearables" },
      { slug: "apple-watch", label: "Apple Watch", query: "tag:collection-apple-watch" },
      { slug: "fitness", label: "Fitness Trackers", query: "tag:collection-whoop" },
      {
        slug: "smart-glasses",
        label: "Smart Glasses",
        query: productTypeQuery(["Smart Glasses"]),
      },
    ],
  },
  {
    slug: "chargers",
    label: "Chargers",
    types: ["Chargers", "Power Banks", "Cables"],
    query: productTypeQuery(["Chargers", "Power Banks", "Cables"]),
    blurb: "Fast chargers and wireless charging pads.",
    art: "charger",
    groups: [
      { slug: "chargers", label: "Wall Chargers", query: productTypeQuery(["Chargers"]) },
      { slug: "power-banks", label: "Power Banks", query: productTypeQuery(["Power Banks"]) },
      { slug: "cables", label: "Cables", query: productTypeQuery(["Cables"]) },
      // Anker and Baseus together outsell Apple in this category despite
      // neither having had a filter before. Both also sell audio/car/laptop
      // gear outside this category, so intersect with this category's own
      // types — otherwise these chips would leak in unrelated products.
      {
        slug: "anker",
        label: "Anker",
        query: `tag:collection-anker AND ${productTypeQuery(["Chargers", "Power Banks", "Cables"])}`,
      },
      {
        slug: "baseus",
        label: "Baseus",
        query: `tag:collection-baseus AND ${productTypeQuery(["Chargers", "Power Banks", "Cables"])}`,
      },
    ],
  },
  {
    slug: "gaming",
    label: "Gaming",
    types: ["Gaming Consoles", "Gaming Accessories", "Gaming Peripherals", "Games", "Gift Cards"],
    query: productTypeQuery([
      "Gaming Consoles",
      "Gaming Accessories",
      "Gaming Peripherals",
      "Games",
      "Gift Cards",
    ]),
    blurb: "Consoles, controllers, and gear for every player.",
    art: "gaming",
    groups: [
      { slug: "consoles", label: "Consoles", query: productTypeQuery(["Gaming Consoles"]) },
      {
        slug: "peripherals",
        label: "Peripherals",
        query: productTypeQuery(["Gaming Peripherals"]),
      },
      {
        slug: "accessories",
        label: "Accessories",
        query: productTypeQuery(["Gaming Accessories"]),
      },
      { slug: "games", label: "Games", query: productTypeQuery(["Games"]) },
      { slug: "gift-cards", label: "Gift Cards", query: productTypeQuery(["Gift Cards"]) },
      // Razer alone is 58% of this category's catalog. Razer also makes
      // gaming headsets categorized as Audio, so intersect with this
      // category's own types to keep the chip scoped to Gaming.
      {
        slug: "razer",
        label: "Razer",
        query: `tag:collection-razer AND ${productTypeQuery(["Gaming Consoles", "Gaming Accessories", "Gaming Peripherals"])}`,
      },
    ],
  },
  {
    slug: "cameras",
    label: "Cameras",
    // Streaming Devices / Media Players are filed under this category slug
    // (closer to content-creation/small-electronics than whitegoods) but
    // stay out of the default `query` — a shopper browsing "Cameras" with no
    // filter applied shouldn't see a set-top box as if it were a camera.
    // They're still reachable via the explicit "Streaming & Media" chip
    // below, and `types` still lists them so categoryForProductType() keeps
    // routing those products here for breadcrumbs/related-category logic.
    types: [
      "Cameras",
      "Camera Accessories",
      "Instant Cameras",
      "Photo Accessories",
      "Gimbals",
      "Streaming Devices",
      "Media Players",
    ],
    query: productTypeQuery(["Cameras", "Camera Accessories", "Instant Cameras", "Photo Accessories", "Gimbals"]),
    blurb: "Cameras, gimbals, and gear for creators.",
    art: "camera",
    groups: [
      { slug: "cameras", label: "Cameras", query: productTypeQuery(["Cameras"]) },
      {
        slug: "instant-cameras",
        label: "Instant Cameras",
        query: productTypeQuery(["Instant Cameras"]),
      },
      { slug: "gimbals", label: "Gimbals & Stabilizers", query: productTypeQuery(["Gimbals"]) },
      {
        slug: "streaming",
        label: "Streaming & Media",
        query: productTypeQuery(["Streaming Devices", "Media Players"]),
      },
      {
        slug: "accessories",
        label: "Camera Accessories",
        query: productTypeQuery(["Camera Accessories", "Photo Accessories"]),
      },
      // DJI is the single largest camera-category vendor (32% of products).
      { slug: "dji", label: "DJI", query: "tag:collection-dji" },
      { slug: "insta360", label: "Insta360", query: "tag:collection-insta360" },
      { slug: "fujifilm", label: "Fujifilm", query: "tag:collection-fujifilm" },
    ],
  },
  {
    slug: "appliances",
    label: "Appliances",
    types: [
      "Televisions",
      "Refrigerators",
      "Washing Machines",
      "Microwaves",
      "Cookers",
      "Freezers",
      "Water Dispensers",
      "Fans",
    ],
    query: productTypeQuery([
      "Televisions",
      "Refrigerators",
      "Washing Machines",
      "Microwaves",
      "Cookers",
      "Freezers",
      "Water Dispensers",
      "Fans",
    ]),
    blurb: "TVs, kitchen, and home appliances for every room.",
    art: "appliance",
    groups: [
      { slug: "tvs", label: "TVs", query: productTypeQuery(["Televisions"]) },
      {
        slug: "kitchen",
        label: "Kitchen Appliances",
        query: productTypeQuery(["Microwaves", "Cookers", "Water Dispensers"]),
      },
      {
        slug: "laundry-cooling",
        label: "Laundry & Cooling",
        query: productTypeQuery(["Washing Machines", "Freezers", "Refrigerators", "Fans"]),
      },
      // Vision Plus is the largest appliance vendor (34% of this category).
      { slug: "vision-plus", label: "Vision Plus", query: "tag:collection-vision-plus" },
      { slug: "hisense", label: "Hisense", query: "tag:collection-hisense" },
      { slug: "tcl", label: "TCL", query: "tag:collection-tcl" },
    ],
  },
  {
    slug: "accessories",
    label: "Accessories",
    types: ["Accessories", "Car Accessories"],
    query: productTypeQuery(["Accessories", "Car Accessories"]),
    blurb: "Cables, cases, car accessories, and everyday essentials.",
    art: "generic",
    groups: [
      { slug: "general", label: "General Accessories", query: productTypeQuery(["Accessories"]) },
      {
        slug: "car",
        label: "Car Accessories",
        query: productTypeQuery(["Car Accessories"]),
      },
    ],
  },
];

export function getCategory(slug: string): Category | undefined {
  return categories.find((c) => c.slug === slug);
}

// Genre browsing only applies within the Gaming category's "Games" group, so
// this lives as its own lookup rather than a generic sub-group concept on
// every category's `groups`.
export const gameGenres: { slug: string; label: string; query: string }[] = [
  { slug: "action", label: "Action", query: "tag:genre-action" },
  { slug: "adventure", label: "Adventure", query: "tag:genre-adventure" },
  { slug: "casual", label: "Casual", query: "tag:genre-casual" },
  { slug: "horror", label: "Horror", query: "tag:genre-horror" },
  { slug: "indie", label: "Indie", query: "tag:genre-indie" },
  { slug: "racing", label: "Racing", query: "tag:genre-racing" },
  { slug: "rpg", label: "RPG", query: "tag:genre-rpg" },
  { slug: "simulation", label: "Simulation", query: "tag:genre-simulation" },
];

export function getGameGenre(slug: string) {
  return gameGenres.find((g) => g.slug === slug);
}

export function genreForProductTags(tags: string[]) {
  return gameGenres.find((g) => tags.includes(`genre-${g.slug}`));
}

// Editorial shelves, same "Games" group scope as gameGenres above — a
// second, independent facet (a game can be both RPG and Beginner Friendly),
// so it's its own lookup rather than folded into gameGenres.
export const gameCollections: { slug: string; label: string; query: string }[] = [
  { slug: "editors-choice", label: "Editor's Choice", query: "tag:collection-editors-choice" },
  { slug: "play-together", label: "Play Together", query: "tag:collection-play-together" },
  { slug: "beginner-friendly", label: "Beginner Friendly", query: "tag:collection-beginner-friendly" },
  { slug: "for-all-ages", label: "For All Ages", query: "tag:collection-for-all-ages" },
];

export function getGameCollection(slug: string) {
  return gameCollections.find((c) => c.slug === slug);
}

/**
 * Cross-sell graph: each category points to its most relevant neighbors,
 * ranked, with a reason a shopper would actually care about. Not symmetric —
 * e.g. wearables lead back to phones, but phones lead to wearables *and*
 * audio, because that's the direction the upsell actually makes sense.
 */
const CATEGORY_MESH: Record<string, { slug: string; reason: string }[]> = {
  phones: [
    { slug: "wearables", reason: "Notifications and fitness tracking on your wrist" },
    { slug: "audio", reason: "Calls and music without the wires" },
  ],
  tablets: [
    { slug: "accessories", reason: "Keyboards, styluses, and cases" },
    { slug: "chargers", reason: "Fast charging for longer sessions" },
  ],
  computers: [
    { slug: "accessories", reason: "Docks, hubs, and stands for your desk" },
    { slug: "chargers", reason: "Power for the road" },
  ],
  audio: [
    { slug: "chargers", reason: "Keep earbuds and speakers topped up" },
    { slug: "wearables", reason: "Control playback from your wrist" },
  ],
  wearables: [
    { slug: "phones", reason: "Pairs with your phone for calls and apps" },
    { slug: "chargers", reason: "Charging docks and cables" },
  ],
  chargers: [
    { slug: "accessories", reason: "Cables, mounts, and everyday extras" },
    { slug: "phones", reason: "Match the wattage to your phone" },
  ],
  gaming: [
    { slug: "audio", reason: "Headsets for chat and immersive sound" },
    { slug: "accessories", reason: "Controllers, stands, and storage" },
  ],
  cameras: [
    { slug: "accessories", reason: "Bags, tripods, and memory cards" },
    { slug: "chargers", reason: "Extra batteries and power banks" },
  ],
  appliances: [
    { slug: "accessories", reason: "Cables and everyday extras" },
    { slug: "chargers", reason: "Power banks and surge protection" },
  ],
  accessories: [
    { slug: "chargers", reason: "Round out your charging kit" },
    { slug: "phones", reason: "Cases and screen protection" },
  ],
};

export function getRelatedCategories(slug: string, limit = 2): { category: Category; reason: string }[] {
  const edges = CATEGORY_MESH[slug] ?? [];
  return edges
    .slice(0, limit)
    .map((edge) => {
      const category = getCategory(edge.slug);
      return category ? { category, reason: edge.reason } : undefined;
    })
    .filter((entry): entry is { category: Category; reason: string } => entry !== undefined);
}

const typeToCategorySlug: Record<string, string> = Object.fromEntries(
  categories.flatMap((c) => c.types.map((t) => [t, c.slug])),
);

export function categoryForProductType(productType: string): Category | undefined {
  const slug = typeToCategorySlug[productType];
  return slug ? getCategory(slug) : undefined;
}
