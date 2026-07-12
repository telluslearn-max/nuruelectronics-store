import type { ArtKind } from "./categories";

export type Collection = {
  slug: string;
  label: string;
  query: string;
  blurb: string;
  art: ArtKind;
  /**
   * Overrides the generic site-wide category label (e.g. "Phones") in this
   * brand's "shop by category" strip with the brand's own product-line name
   * (e.g. "iPhone"), keyed by category slug. Categories without an entry
   * here fall back to the generic label — only override where the brand has
   * an actual, well-known first-party name for that category.
   */
  categoryLabels?: Record<string, string>;
  /**
   * Multi-category brands with broad enough catalog presence to warrant
   * top billing — shown in the nav's brand flyout and the "Top Brands"
   * section of the brand index. Everything else still gets a full page,
   * just reached via "All Brands" instead of being surfaced everywhere.
   */
  featured?: boolean;
};

// Shopify search syntax requires quoting tag values that contain spaces or
// special characters — build tag queries through this helper rather than
// hand-writing raw "tag:x OR tag:y" strings, mirroring productTypeQuery in
// categories.ts.
function tagQuery(tags: string[]): string {
  return tags.map((t) => (/[\s"]/.test(t) ? `tag:${JSON.stringify(t)}` : `tag:${t}`)).join(" OR ");
}

export const ecosystems: Collection[] = [
  {
    slug: "samsung",
    label: "Samsung",
    query: tagQuery(["samsung"]),
    blurb:
      "The full Galaxy lineup — phones, tablets, watches, and buds — built to work together out of the box, plus the TVs and appliances that round out a connected home.",
    art: "phone",
    categoryLabels: { phones: "Galaxy Phones", tablets: "Galaxy Tab", wearables: "Galaxy Watch" },
    featured: true,
  },
  {
    slug: "apple",
    label: "Apple",
    query: tagQuery(["apple"]),
    blurb:
      "iPhone, Mac, iPad, and Apple Watch, plus the chargers, cases, and cables that tie them together — every unit genuine and backed by manufacturer warranty.",
    art: "phone",
    categoryLabels: { phones: "iPhone", computers: "Mac", tablets: "iPad", wearables: "Apple Watch" },
    featured: true,
  },
  {
    slug: "google",
    label: "Google",
    query: tagQuery(["google"]),
    blurb:
      "Pixel phones built around the camera and on-device AI Google is known for, plus the streaming devices and smart speakers that bring Assistant into your home.",
    art: "generic",
    categoryLabels: { phones: "Pixel" },
    featured: true,
  },
  {
    slug: "huawei",
    label: "Huawei",
    query: tagQuery(["huawei"]),
    blurb: "Huawei wearables for shoppers who want flagship build quality outside the usual ecosystem.",
    art: "watch",
    featured: true,
  },
  {
    slug: "meta",
    label: "Meta",
    query: tagQuery(["meta"]),
    blurb:
      "Ray-Ban Meta smart glasses — camera, speakers, and Meta AI built into a frame you'd actually wear, no phone out required to catch the moment.",
    art: "generic",
    categoryLabels: { wearables: "Smart Glasses" },
    featured: true,
  },
  {
    slug: "microsoft",
    label: "Microsoft",
    query: tagQuery(["microsoft"]),
    blurb:
      "Surface laptops and tablets built for getting work done, with the docks, styluses, and hubs to set up a proper desk.",
    art: "laptop",
    categoryLabels: { computers: "Surface Laptops", tablets: "Surface" },
    featured: true,
  },
  {
    slug: "nothing",
    label: "Nothing",
    query: tagQuery(["nothing"]),
    blurb:
      "Nothing phones and earbuds — known for transparent design and a stock Android experience that stays out of your way.",
    art: "phone",
    categoryLabels: { phones: "Nothing Phone", audio: "Nothing Ear" },
    featured: true,
  },
  {
    slug: "oneplus",
    label: "OnePlus",
    query: tagQuery(["oneplus"]),
    blurb: "OnePlus phones tuned for speed, paired with the chargers and accessories to keep pace with them.",
    art: "phone",
    featured: true,
  },
  {
    slug: "redmi-xiaomi",
    label: "Redmi & Xiaomi",
    query: tagQuery(["redmi", "xiaomi"]),
    blurb:
      "Redmi and Xiaomi phones and tablets that deliver flagship-grade specs — big batteries, fast charging, sharp displays — without the flagship price.",
    art: "phone",
    featured: true,
  },
  {
    slug: "sony",
    label: "Sony",
    query: tagQuery(["sony"]),
    blurb:
      "Sony cameras for creators, audio gear for critical listening, and gaming hardware for the PlayStation faithful.",
    art: "camera",
    categoryLabels: { gaming: "PlayStation" },
    featured: true,
  },
  // Smaller, single- or few-category brands — most of these previously only
  // existed as filter chips nested inside a category page, with no brand
  // page of their own. Ordered by catalog size, largest first. Not
  // "featured": still get a full page, just reached via "All Brands"
  // rather than the nav flyout and brand-index top section.
  {
    slug: "jbl",
    label: "JBL",
    query: tagQuery(["jbl"]),
    blurb: "Speakers, headphones, earbuds, and microphones with JBL's signature sound.",
    art: "buds",
  },
  {
    slug: "baseus",
    label: "Baseus",
    query: tagQuery(["baseus"]),
    blurb: "Chargers, cables, power banks, and desk accessories for phones, laptops, and cars.",
    art: "charger",
  },
  {
    slug: "vision-plus",
    label: "Vision Plus",
    query: tagQuery(["vision-plus"]),
    blurb: "TVs, sound bars, and kitchen and laundry appliances for the home.",
    art: "appliance",
  },
  {
    slug: "boya",
    label: "BOYA",
    query: tagQuery(["boya"]),
    blurb: "Microphones and audio accessories built for creators and podcasters.",
    art: "generic",
  },
  {
    slug: "amazon",
    label: "Amazon",
    query: tagQuery(["amazon"]),
    blurb: "Kindle e-readers, Fire tablets, Echo smart speakers, and Fire TV streaming devices.",
    art: "generic",
  },
  {
    slug: "dji",
    label: "DJI",
    query: tagQuery(["dji"]),
    blurb: "Gimbals, cameras, and microphones for creators who shoot on the move.",
    art: "camera",
  },
  {
    slug: "anker",
    label: "Anker",
    query: tagQuery(["anker"]),
    blurb: "Fast chargers, power banks, and car accessories built for everyday reliability.",
    art: "charger",
  },
  {
    slug: "bose",
    label: "Bose",
    query: tagQuery(["bose"]),
    blurb: "Headphones, earbuds, and speakers tuned for noise cancellation and clarity.",
    art: "buds",
  },
  {
    slug: "hisense",
    label: "Hisense",
    query: tagQuery(["hisense"]),
    blurb: "TVs, sound bars, and kitchen appliances for the home.",
    art: "appliance",
  },
  {
    slug: "rode",
    label: "Rode",
    query: tagQuery(["rode"]),
    blurb: "Microphones and audio accessories built for creators.",
    art: "generic",
  },
  {
    slug: "cmf",
    label: "CMF by Nothing",
    query: tagQuery(["cmf"]),
    blurb: "Budget-friendly watches, earbuds, and headphones from Nothing's CMF line.",
    art: "watch",
  },
  {
    slug: "razer",
    label: "Razer",
    query: tagQuery(["razer"]),
    blurb: "Gaming peripherals and audio built for competitive play.",
    art: "gaming",
  },
  {
    slug: "shokz",
    label: "Shokz",
    query: tagQuery(["shokz"]),
    blurb: "Open-ear headphones and earbuds built for running and workouts.",
    art: "buds",
  },
  {
    slug: "tcl",
    label: "TCL",
    query: tagQuery(["tcl"]),
    blurb: "TVs and washing machines built for everyday value.",
    art: "appliance",
  },
  {
    slug: "beats",
    label: "Beats",
    query: tagQuery(["beats"]),
    blurb: "Headphones and earbuds with punchy sound, from the Apple-owned audio brand.",
    art: "buds",
  },
  {
    slug: "marshall",
    label: "Marshall",
    query: tagQuery(["marshall"]),
    blurb: "Speakers and headphones with Marshall's classic amp-inspired sound.",
    art: "buds",
  },
  {
    slug: "fujifilm",
    label: "Fujifilm",
    query: tagQuery(["fujifilm"]),
    blurb: "Instant cameras and photo accessories for shooting straight to print.",
    art: "camera",
  },
  {
    slug: "remarkable",
    label: "reMarkable",
    query: tagQuery(["remarkable"]),
    blurb: "E-readers and tablet accessories built for distraction-free writing and reading.",
    art: "tablet",
  },
  {
    slug: "hollyland",
    label: "Hollyland",
    query: tagQuery(["hollyland"]),
    blurb: "Wireless microphones for creators and presenters.",
    art: "generic",
  },
  {
    slug: "whoop",
    label: "Whoop",
    query: tagQuery(["whoop"]),
    blurb: "Fitness trackers built for recovery and performance tracking.",
    art: "watch",
  },
  {
    slug: "zhiyun",
    label: "Zhiyun",
    query: tagQuery(["zhiyun"]),
    blurb: "Gimbals for smooth, stabilized video.",
    art: "camera",
  },
  {
    slug: "skyworth",
    label: "Skyworth",
    query: tagQuery(["skyworth"]),
    blurb: "TVs built for everyday home entertainment.",
    art: "appliance",
  },
  {
    slug: "sonos",
    label: "Sonos",
    query: tagQuery(["sonos"]),
    blurb: "Speakers built for whole-home, multi-room sound.",
    art: "buds",
  },
  {
    slug: "canon",
    label: "Canon",
    query: tagQuery(["canon"]),
    blurb: "Cameras for photographers who want full manual control.",
    art: "camera",
  },
  {
    slug: "kodak",
    label: "Kodak",
    query: tagQuery(["kodak"]),
    blurb: "Cameras for shooters who want a classic point-and-shoot feel.",
    art: "camera",
  },
  {
    slug: "lg",
    label: "LG",
    query: tagQuery(["lg"]),
    blurb: "Home audio speakers built for room-filling sound.",
    art: "buds",
  },
  {
    slug: "ramtons",
    label: "Ramtons",
    query: tagQuery(["ramtons"]),
    blurb: "Refrigerators built for East African homes.",
    art: "appliance",
  },
  {
    slug: "denon",
    label: "Denon",
    query: tagQuery(["denon"]),
    blurb: "Home audio speakers built for critical listening.",
    art: "buds",
  },
  {
    slug: "gopro",
    label: "GoPro",
    query: tagQuery(["gopro"]),
    blurb: "Action cameras built for capturing motion.",
    art: "camera",
  },
  {
    slug: "nintendo",
    label: "Nintendo",
    query: tagQuery(["nintendo"]),
    blurb: "Consoles for playing anywhere, on the TV or on the go.",
    art: "gaming",
  },
  {
    slug: "onn",
    label: "onn.",
    query: tagQuery(["onn"]),
    blurb: "Budget streaming devices for getting your TV online.",
    art: "generic",
  },
  {
    slug: "steelseries",
    label: "SteelSeries",
    query: tagQuery(["steelseries"]),
    blurb: "Gaming peripherals built for competitive play.",
    art: "gaming",
  },
  {
    slug: "vitron",
    label: "Vitron",
    query: tagQuery(["vitron"]),
    blurb: "TVs built for East African homes.",
    art: "appliance",
  },
];

export const kits: Collection[] = [
  {
    slug: "accessories",
    label: "Accessories Starter Kit",
    query: tagQuery(["kit-accessories"]),
    blurb: "Everyday essentials to go with your new device.",
    art: "generic",
  },
  {
    slug: "car-accessories",
    label: "Car Essentials",
    query: tagQuery(["kit-car-accessories"]),
    blurb: "Mounts, chargers, and accessories for the road.",
    art: "generic",
  },
  {
    slug: "content-creator",
    label: "Content Creator Kit",
    query: tagQuery(["kit-content-creator"]),
    blurb: "Cameras, gimbals, and microphones to start creating.",
    art: "camera",
  },
  {
    slug: "fitness",
    label: "Fitness & Health",
    query: tagQuery(["kit-fitness"]),
    blurb: "Watches, trackers, and wearables to help you move.",
    art: "watch",
  },
  {
    slug: "gaming",
    label: "Gaming Setup",
    query: tagQuery(["kit-gaming"]),
    blurb: "Consoles, peripherals, and audio for every player.",
    art: "gaming",
  },
  {
    slug: "home-appliances",
    label: "Home Appliances",
    query: tagQuery(["kit-home-appliances"]),
    blurb: "Fridges, washers, and everyday appliances for the home.",
    art: "appliance",
  },
  {
    slug: "home-audio",
    label: "Home Audio",
    query: tagQuery(["kit-home-audio"]),
    blurb: "Speakers and sound systems for every room.",
    art: "buds",
  },
  {
    slug: "home-theater",
    label: "Home Theater",
    query: tagQuery(["kit-home-theater"]),
    blurb: "TVs, sound bars, and streaming devices for movie nights.",
    art: "appliance",
  },
  {
    slug: "power-charging",
    label: "Power & Charging",
    query: tagQuery(["kit-power-charging"]),
    blurb: "Chargers, power banks, and cables to keep everything topped up.",
    art: "charger",
  },
  {
    slug: "work-study",
    label: "Work & Study",
    query: tagQuery(["kit-work-study"]),
    blurb: "Laptops, tablets, and accessories for getting things done.",
    art: "laptop",
  },
];

const ECOSYSTEM_TAGS = ecosystems.flatMap((e) =>
  Array.from(e.query.matchAll(/tag:([a-z0-9-]+)/g), (m) => m[1]),
);

/** The brand/ecosystem tag on a product (e.g. "apple", "samsung"), if it has one. */
export function ecosystemTagForProduct(tags: string[]): string | undefined {
  return tags.find((tag) => ECOSYSTEM_TAGS.includes(tag));
}

const ecosystemsBySlug = new Map(ecosystems.map((e) => [e.slug, e]));
const kitsBySlug = new Map(kits.map((k) => [k.slug, k]));

export function getEcosystem(slug: string): Collection | undefined {
  return ecosystemsBySlug.get(slug);
}

export function getKit(slug: string): Collection | undefined {
  return kitsBySlug.get(slug);
}

/** Multi-category brands with broad catalog presence — for the nav flyout and the brand index's top section. */
export function getFeaturedEcosystems(): Collection[] {
  return ecosystems.filter((e) => e.featured);
}
