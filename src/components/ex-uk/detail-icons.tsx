import type { ConditionChipIcon } from "./condition-grade";

// Custom vector icons for the Ex-UK detail overlay — replaces plain Unicode emoji (📦 🛡️ ✅ 💰 🔋
// 〰️ 👀 ✨), which render inconsistently across platforms/fonts and look flat next to the
// deck's already-custom SVG icons (action-icons.tsx).

export function BoxIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 8.5 12 4l9 4.5-9 4.5-9-4.5Z" />
      <path d="M3 8.5V17l9 4.5 9-4.5V8.5M12 13v8.5" />
    </svg>
  );
}

export function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3.5 19 6.5v5c0 5-3 8.3-7 9.5-4-1.2-7-4.5-7-9.5v-5l7-3Z" />
    </svg>
  );
}

export function CoinIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v10M9 9.5c0-1.4 1.3-2.5 3-2.5s3 1 3 2.2-1.3 1.8-3 2.3-3 1.1-3 2.3 1.3 2.2 3 2.2 3-1.1 3-2.5" />
    </svg>
  );
}

const CHIP_ICON_PATHS: Record<ConditionChipIcon, React.ReactNode> = {
  battery: (
    <>
      <rect x="2.5" y="8" width="16" height="8" rx="2" />
      <path d="M21 10.5v3" />
    </>
  ),
  check: <path d="M4 12.5 9 17l11-11" />,
  wear: <path d="M3 12h3l2-3 4 6 2-4 2 2h4" />,
  sparkle: <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6.5 6.5l2 2M15.5 15.5l2 2M17.5 6.5l-2 2M8.5 15.5l-2 2" />,
};

export function ConditionChipIconGlyph({ icon, className }: { icon: ConditionChipIcon; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {CHIP_ICON_PATHS[icon]}
    </svg>
  );
}
