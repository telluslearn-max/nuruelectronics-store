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

export const categories: Category[] = [
  {
    slug: "phones",
    label: "Phones",
    types: ["Smartphones"],
    query: productTypeQuery(["Smartphones"]),
    blurb: "Smartphones from Samsung, Apple, Google, and more.",
    art: "phone",
    groups: [
      { slug: "foldables", label: "Foldables", query: "tag:collection-foldables" },
      { slug: "s26", label: "Galaxy S26", query: "tag:collection-galaxy-s26-series" },
      { slug: "s25", label: "Galaxy S25", query: "tag:collection-galaxy-s25-series" },
      { slug: "a-series", label: "Galaxy A", query: "tag:collection-galaxy-a-series" },
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
    ],
  },
  {
    slug: "gaming",
    label: "Gaming",
    types: ["Gaming Consoles", "Gaming Accessories", "Gaming Peripherals"],
    query: productTypeQuery(["Gaming Consoles", "Gaming Accessories", "Gaming Peripherals"]),
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
    ],
  },
  {
    slug: "cameras",
    label: "Cameras",
    // Streaming Devices / Media Players live here rather than under
    // Appliances — closer to content-creation/small-electronics than
    // whitegoods.
    types: [
      "Cameras",
      "Camera Accessories",
      "Instant Cameras",
      "Photo Accessories",
      "Gimbals",
      "Streaming Devices",
      "Media Players",
    ],
    query: productTypeQuery([
      "Cameras",
      "Camera Accessories",
      "Instant Cameras",
      "Photo Accessories",
      "Gimbals",
      "Streaming Devices",
      "Media Players",
    ]),
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

const typeToCategorySlug: Record<string, string> = Object.fromEntries(
  categories.flatMap((c) => c.types.map((t) => [t, c.slug])),
);

export function categoryForProductType(productType: string): Category | undefined {
  const slug = typeToCategorySlug[productType];
  return slug ? getCategory(slug) : undefined;
}
