import type { Badge } from "@/lib/badges";

export function ProductBadges({ badges, variant }: { badges: Badge[]; variant: "card" | "inline" }) {
  if (badges.length === 0) return null;

  if (variant === "card") {
    return (
      <div className="absolute left-3 top-3 flex flex-col items-start gap-1">
        {badges.slice(0, 2).map((badge) => (
          <span
            key={badge.key}
            className={`rounded-control px-2.5 py-1 text-xs font-medium ${badge.className}`}
          >
            {badge.label}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {badges.map((badge) => (
        <span key={badge.key} className={`rounded-control px-2 py-0.5 text-xs font-medium ${badge.className}`}>
          {badge.label}
        </span>
      ))}
    </div>
  );
}
