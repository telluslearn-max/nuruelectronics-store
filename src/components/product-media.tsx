import Image from "next/image";
import { categoryForProductType, type ArtKind } from "@/lib/categories";
import type { ProductImage } from "@/lib/shopify/types";

const ART: Record<ArtKind, React.ReactNode> = {
  phone: (
    <>
      <rect x="65" y="35" width="70" height="130" rx="14" />
      <line x1="88" y1="48" x2="112" y2="48" />
    </>
  ),
  tablet: (
    <>
      <rect x="50" y="40" width="100" height="120" rx="12" />
      <circle cx="100" cy="146" r="4" />
    </>
  ),
  buds: (
    <>
      <circle cx="76" cy="86" r="18" />
      <path d="M76 104v26a10 10 0 0 0 10 10" />
      <circle cx="124" cy="86" r="18" />
      <path d="M124 104v26a10 10 0 0 1-10 10" />
    </>
  ),
  watch: (
    <>
      <rect x="65" y="65" width="70" height="70" rx="18" />
      <path d="M78 65v-22h44v22" />
      <path d="M78 135v22h44v-22" />
    </>
  ),
  charger: (
    <>
      <rect x="60" y="60" width="60" height="60" rx="12" />
      <path d="M120 90h14a12 12 0 0 1 12 12v32" />
      <line x1="76" y1="82" x2="76" y2="98" />
      <line x1="92" y1="82" x2="92" y2="98" />
    </>
  ),
  laptop: (
    <>
      <rect x="65" y="55" width="70" height="75" rx="6" />
      <path d="M55 130h90l8 20H47l8-20z" />
    </>
  ),
  gaming: (
    <>
      <rect x="45" y="80" width="110" height="55" rx="24" />
      <circle cx="80" cy="107" r="7" />
      <circle cx="120" cy="100" r="5" />
      <circle cx="132" cy="112" r="5" />
    </>
  ),
  camera: (
    <>
      <rect x="50" y="70" width="100" height="70" rx="10" />
      <circle cx="100" cy="105" r="24" />
      <rect x="80" y="55" width="30" height="18" rx="4" />
    </>
  ),
  appliance: (
    <>
      <rect x="55" y="45" width="90" height="110" rx="8" />
      <line x1="55" y1="90" x2="145" y2="90" />
      <circle cx="75" cy="70" r="4" />
    </>
  ),
  generic: (
    <>
      <rect x="55" y="55" width="90" height="90" rx="16" />
      <circle cx="100" cy="100" r="6" />
    </>
  ),
};

export function ArtGlyph({ kind, className }: { kind: ArtKind; className?: string }) {
  return (
    <svg
      viewBox="40 30 120 140"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="4"
      strokeLinecap="round"
      aria-hidden="true"
    >
      {ART[kind]}
    </svg>
  );
}

function PlaceholderArt({ kind }: { kind: ArtKind }) {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-neutral-50 to-neutral-200/70 text-neutral-300"
    >
      <svg
        viewBox="0 0 200 200"
        className="h-3/4 w-3/4"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      >
        {ART[kind]}
        <text
          x="100"
          y="188"
          textAnchor="middle"
          fontSize="12"
          letterSpacing="3"
          fill="currentColor"
          stroke="none"
          fontWeight="600"
        >
          NURU
        </text>
      </svg>
    </div>
  );
}

export function ProductMedia({
  image,
  title,
  productType,
  sizes,
  priority = false,
  className = "object-cover",
}: {
  image: ProductImage | undefined | null;
  title: string;
  productType?: string;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  if (!image) {
    const kind = (productType && categoryForProductType(productType)?.art) || "generic";
    return <PlaceholderArt kind={kind} />;
  }

  return (
    <Image
      src={image.url}
      alt={image.altText ?? title}
      fill
      className={className}
      sizes={sizes}
      priority={priority}
    />
  );
}
