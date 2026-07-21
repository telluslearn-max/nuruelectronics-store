import { categories } from "@/lib/categories";
import { getFeaturedEcosystems, kits } from "@/lib/collections";

export type PanelLink = { href: string; label: string };
export type NavEntry = { id: string; label: string; href: string; panelItems: PanelLink[] };

export function getNavEntries(): NavEntry[] {
  return [
    { id: "shop", label: "Shop", href: "/shop", panelItems: [] },
    ...categories.map((category) => ({
      id: `category-${category.slug}`,
      label: category.label,
      href: `/category/${category.slug}`,
      panelItems: (category.groups ?? []).map((g) => ({
        href: `/category/${category.slug}?group=${g.slug}`,
        label: g.label,
      })),
    })),
    {
      id: "ecosystems",
      label: "Shop by Brand",
      href: "/ecosystem",
      panelItems: [
        ...getFeaturedEcosystems().map((e) => ({ href: `/ecosystem/${e.slug}`, label: e.label })),
        { href: "/ecosystem", label: "View all brands →" },
      ],
    },
    {
      id: "kits",
      label: "Shop by Need",
      href: "/kit",
      panelItems: kits.map((k) => ({ href: `/kit/${k.slug}`, label: k.label })),
    },
    { id: "ex-uk", label: "Ex-UK", href: "/ex-uk", panelItems: [] },
    { id: "support", label: "Support", href: "/support", panelItems: [] },
  ];
}
