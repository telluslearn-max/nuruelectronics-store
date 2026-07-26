/**
 * Shared by Nav (desktop mega-menu) and MobileTabBar so "is this nav entry active" is answered
 * the same way in both. Nav used to check `pathname === entry.href` exactly, which meant a
 * category's own nav entry never highlighted while browsing one of its subpages (e.g.
 * `/category/phones?group=iphone`) — this instead treats `href` and anything nested under it
 * as active, matching how MobileTabBar's route-family tabs already behaved.
 */
export function isRouteActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** True when `pathname` matches any of the given href prefixes — for tabs that bucket several
    route families together (e.g. MobileTabBar's "Shop" tab covering /shop, /category, /ecosystem, /kit). */
export function isRouteActiveAny(pathname: string, hrefs: string[]): boolean {
  return hrefs.some((href) => isRouteActive(pathname, href));
}
