import type { ArtKind } from "@/lib/categories";
import { categories } from "@/lib/categories";
import { getFeaturedEcosystems, kits } from "@/lib/collections";

export type PanelLink = { href: string; label: string };
export type NavIconKind = ArtKind | "shop" | "brand" | "need" | "ex-uk" | "support";
export type NavEntry = { id: string; label: string; href: string; icon: NavIconKind; panelItems: PanelLink[] };

export function getNavEntries(): NavEntry[] {
  return [
    { id: "shop", label: "Shop", href: "/shop", icon: "shop", panelItems: [] },
    ...categories.map((category) => ({
      id: `category-${category.slug}`,
      label: category.label,
      href: `/category/${category.slug}`,
      icon: category.art,
      panelItems: (category.groups ?? []).map((g) => ({
        href: `/category/${category.slug}?group=${g.slug}`,
        label: g.label,
      })),
    })),
    {
      id: "ecosystems",
      label: "Shop by Brand",
      href: "/ecosystem",
      icon: "brand" as const,
      panelItems: [
        ...getFeaturedEcosystems().map((e) => ({ href: `/ecosystem/${e.slug}`, label: e.label })),
        { href: "/ecosystem", label: "View all brands →" },
      ],
    },
    {
      id: "kits",
      label: "Shop by Need",
      href: "/kit",
      icon: "need" as const,
      panelItems: kits.map((k) => ({ href: `/kit/${k.slug}`, label: k.label })),
    },
    { id: "ex-uk", label: "Ex-UK", href: "/ex-uk", icon: "ex-uk" as const, panelItems: [] },
    { id: "support", label: "Support", href: "/support", icon: "support" as const, panelItems: [] },
  ];
}
