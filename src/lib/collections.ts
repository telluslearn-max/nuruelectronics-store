import type { ArtKind } from "./categories";

export type Collection = {
  slug: string;
  label: string;
  query: string;
  blurb: string;
  art: ArtKind;
};

export const ecosystems: Collection[] = [
  {
    slug: "samsung",
    label: "Samsung",
    query: "tag:ecosystem-samsung",
    blurb: "Galaxy phones, tablets, watches, and audio in one ecosystem.",
    art: "phone",
  },
  {
    slug: "apple",
    label: "Apple",
    query: "tag:ecosystem-apple",
    blurb: "iPhone, Mac, iPad, Watch, and Apple accessories in one place.",
    art: "phone",
  },
  {
    slug: "google",
    label: "Google",
    query: "tag:ecosystem-google",
    blurb: "Pixel phones, streaming devices, and smart speakers.",
    art: "generic",
  },
  {
    slug: "huawei",
    label: "Huawei",
    query: "tag:ecosystem-huawei",
    blurb: "Huawei phones and devices.",
    art: "phone",
  },
  {
    slug: "meta",
    label: "Meta",
    query: "tag:ecosystem-meta",
    blurb: "Ray-Ban Meta smart glasses and Meta devices.",
    art: "generic",
  },
  {
    slug: "microsoft",
    label: "Microsoft",
    query: "tag:ecosystem-microsoft",
    blurb: "Surface laptops, tablets, and accessories.",
    art: "laptop",
  },
  {
    slug: "nothing",
    label: "Nothing",
    query: "tag:ecosystem-nothing",
    blurb: "Nothing phones and earbuds.",
    art: "phone",
  },
  {
    slug: "oneplus",
    label: "OnePlus",
    query: "tag:ecosystem-oneplus",
    blurb: "OnePlus phones and accessories.",
    art: "phone",
  },
  {
    slug: "redmi-xiaomi",
    label: "Redmi & Xiaomi",
    query: "tag:ecosystem-redmi-xiaomi",
    blurb: "Redmi and Xiaomi phones, tablets, and more.",
    art: "phone",
  },
  {
    slug: "sony",
    label: "Sony",
    query: "tag:ecosystem-sony",
    blurb: "Sony cameras, audio, and gaming gear.",
    art: "camera",
  },
];

export const kits: Collection[] = [
  {
    slug: "accessories",
    label: "Accessories Starter Kit",
    query: "tag:kit-accessories",
    blurb: "Everyday essentials to go with your new device.",
    art: "generic",
  },
  {
    slug: "car-accessories",
    label: "Car Essentials",
    query: "tag:kit-car-accessories",
    blurb: "Mounts, chargers, and accessories for the road.",
    art: "generic",
  },
  {
    slug: "content-creator",
    label: "Content Creator Kit",
    query: "tag:kit-content-creator",
    blurb: "Cameras, gimbals, and microphones to start creating.",
    art: "camera",
  },
  {
    slug: "fitness",
    label: "Fitness & Health",
    query: "tag:kit-fitness",
    blurb: "Watches, trackers, and wearables to help you move.",
    art: "watch",
  },
  {
    slug: "gaming",
    label: "Gaming Setup",
    query: "tag:kit-gaming",
    blurb: "Consoles, peripherals, and audio for every player.",
    art: "gaming",
  },
  {
    slug: "home-appliances",
    label: "Home Appliances",
    query: "tag:kit-home-appliances",
    blurb: "Fridges, washers, and everyday appliances for the home.",
    art: "appliance",
  },
  {
    slug: "home-audio",
    label: "Home Audio",
    query: "tag:kit-home-audio",
    blurb: "Speakers and sound systems for every room.",
    art: "buds",
  },
  {
    slug: "home-theater",
    label: "Home Theater",
    query: "tag:kit-home-theater",
    blurb: "TVs, sound bars, and streaming devices for movie nights.",
    art: "appliance",
  },
  {
    slug: "power-charging",
    label: "Power & Charging",
    query: "tag:kit-power-charging",
    blurb: "Chargers, power banks, and cables to keep everything topped up.",
    art: "charger",
  },
  {
    slug: "work-study",
    label: "Work & Study",
    query: "tag:kit-work-study",
    blurb: "Laptops, tablets, and accessories for getting things done.",
    art: "laptop",
  },
];

export function getEcosystem(slug: string): Collection | undefined {
  return ecosystems.find((e) => e.slug === slug);
}

export function getKit(slug: string): Collection | undefined {
  return kits.find((k) => k.slug === slug);
}
