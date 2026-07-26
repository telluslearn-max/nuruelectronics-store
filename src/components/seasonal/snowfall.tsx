import type { CSSProperties } from "react";

const PARTICLE_COUNT = 20;

type Flake = {
  left: number;
  delay: number;
  duration: number;
  size: number;
  drift: number;
  opacity: number;
};

function makeFlakes(count: number): Flake[] {
  return Array.from({ length: count }, () => ({
    left: Math.random() * 100,
    delay: Math.random() * 8,
    duration: 8 + Math.random() * 6,
    size: 4 + Math.random() * 4,
    drift: Math.random() * 40 - 20,
    opacity: 0.3 + Math.random() * 0.3,
  }));
}

// Server Component: no hydration to mismatch against, so per-flake Math.random() at render
// time is safe here (unlike a client component, where hydration would re-run it and diverge
// from the server-rendered markup) — and it keeps this purely decorative piece out of the
// client bundle entirely.
export function Snowfall() {
  const flakes = makeFlakes(PARTICLE_COUNT);

  return (
    <div className="pointer-events-none fixed inset-0 z-10 overflow-hidden" aria-hidden="true">
      {flakes.map((flake, index) => (
        <span
          key={index}
          className="absolute top-[-5%] block animate-snowfall rounded-full bg-white"
          style={
            {
              left: `${flake.left}%`,
              width: flake.size,
              height: flake.size,
              opacity: flake.opacity,
              animationDelay: `${flake.delay}s`,
              animationDuration: `${flake.duration}s`,
              "--drift": `${flake.drift}px`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
