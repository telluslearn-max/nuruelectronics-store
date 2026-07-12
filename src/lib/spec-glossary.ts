import type { FaqItem } from "@/components/faq";
import { SPEC_LABELS } from "@/components/product-specs";
import type { ProductSpec } from "@/lib/shopify/types";

/** Plain-English explanation of what a spec means for the buyer, keyed the same as SPEC_LABELS in product-specs.tsx. */
export const SPEC_GLOSSARY: Record<string, string> = {
  processor: "The chip that runs everything on the device. A faster processor with more cores handles heavier multitasking, gaming, and editing more smoothly — light use (calls, browsing, basic apps) doesn't need the top tier.",
  ram: "Memory used to hold apps you have open. More RAM means more apps stay loaded in the background without slowing down or restarting when you switch between them.",
  storage: "How much space is on the device for apps, photos, and files. Larger storage matters most if you shoot a lot of photos/video or keep many apps installed — it can't be expanded after purchase unless the device supports a memory card.",
  os: "The software platform the device runs — this determines the app store, ecosystem it syncs with, and how long it will keep getting updates.",
  display: "The screen's size and panel type. Larger, higher-refresh-rate displays are better for video and gaming but use more battery.",
  resolution: "How sharp the screen or camera output is. Higher resolution means finer detail, most noticeable on larger screens or when zooming into photos.",
  camera: "The main camera's resolution and setup. Higher megapixels help with cropping and large prints, but low-light performance and lens quality matter just as much as the number.",
  battery: "How much charge the device holds. Larger capacity generally means longer use between charges, though actual battery life also depends on screen size and how the device is used.",
  connectivity: "Which networks and wireless standards the device supports — check this matches what you need (e.g. 5G, Wi-Fi standard, Bluetooth version).",
  water_resistance: "The IP rating for dust and water protection. Higher ratings tolerate more exposure, but this isn't a guarantee against submersion damage claims under warranty.",
  compatibility: "What this accessory is designed to work with — check your own device is on this list before buying.",
  driver_size: "The size of the speaker component inside headphones/earbuds. Larger drivers often (not always) produce fuller bass, but tuning matters more than size alone.",
  frequency_response: "The range of pitches an audio device can reproduce. A wider range generally means more detail at both the low and high end.",
  output_power: "How much power a charger or power bank delivers — match this to your device's fast-charging spec to actually charge at full speed.",
  capacity: "How much charge a power bank holds, or how much a battery-powered device can store — higher capacity means more charges or longer runtime before needing a recharge.",
};

/** Builds Faq-style Q&As only for the specs this specific product actually has, in the same order as its specs list. */
export function buildSpecsGuide(specs: ProductSpec[]): FaqItem[] {
  return specs
    .filter((spec) => SPEC_GLOSSARY[spec.key])
    .map((spec) => ({
      q: `What does "${SPEC_LABELS[spec.key] ?? spec.key}" mean for this product?`,
      a: SPEC_GLOSSARY[spec.key],
    }));
}
