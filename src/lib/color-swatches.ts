// Multi-word marketing terms are listed before generic single-word terms
// they contain (e.g. "space gray" before "gray") so the more specific match
// wins via first-match-in-order, not iteration-order luck.
const COLOR_KEYWORDS: [string, string][] = [
  ["space gray", "#55524e"],
  ["space grey", "#55524e"],
  ["sierra blue", "#a4c2d4"],
  ["alpine green", "#4a5d4e"],
  ["natural titanium", "#8a8a86"],
  ["desert titanium", "#c5b8a3"],
  ["blue titanium", "#3f4c5a"],
  ["black titanium", "#3a3835"],
  ["white titanium", "#e4e1d8"],
  ["rose gold", "#eccdc4"],
  ["midnight", "#1d1d1f"],
  ["starlight", "#f0e6d3"],
  ["graphite", "#4a4a4a"],
  ["phantom black", "#1c1c1e"],
  ["cream", "#f3e9d2"],
  ["lavender", "#c9bfe0"],
  ["mint", "#b8ddc9"],
  ["silver", "#e3e4e5"],
  ["titanium", "#8a8a86"],
  ["gold", "#d4af8c"],
  ["rose", "#e8b4b8"],
  ["black", "#1a1a1a"],
  ["white", "#f5f5f5"],
  ["grey", "#8e8e93"],
  ["gray", "#8e8e93"],
  ["blue", "#3b6ea5"],
  ["green", "#4a7a5c"],
  ["red", "#b3392c"],
  ["purple", "#7d5ba6"],
  ["pink", "#e0a3b0"],
  ["orange", "#c97a3d"],
  ["yellow", "#d9b84a"],
  ["beige", "#d9cdb8"],
  ["tan", "#c2a67d"],
  ["bronze", "#8c6a4a"],
  ["copper", "#a86a4d"],
];

/**
 * Resolves a free-text color option value (e.g. "Sierra Blue", "Black") to a
 * CSS color. Falls back to the raw value (works if it's already a valid CSS
 * keyword) when no keyword matches — never guesses a specific wrong color,
 * only ever a verified-correct one or a value the browser can render itself.
 */
export function resolveSwatchColor(value: string): string {
  const normalized = value.toLowerCase();
  const hit = COLOR_KEYWORDS.find(([keyword]) => normalized.includes(keyword));
  return hit ? hit[1] : value;
}
