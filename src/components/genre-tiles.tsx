import Link from "next/link";
import { gameGenres } from "@/lib/categories";
import { ArtGlyph } from "./product-media";

/**
 * Genre browsing for the Gaming category's "Games" group. Unlike
 * `CollectionTiles`, these link via query params (?group=games&genre=...)
 * rather than path segments, so it can't reuse that component directly.
 */
export function GenreTiles({
  basePath,
  activeGenre,
}: {
  basePath: string;
  activeGenre?: string;
}) {
  return (
    <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      <Link
        href={basePath}
        className={`group flex flex-col items-center gap-3 rounded-card border p-6 text-center transition ${
          !activeGenre ? "border-foreground" : "border-border-subtle hover:border-foreground"
        }`}
      >
        <ArtGlyph
          kind="gaming"
          className={`h-14 w-14 transition ${
            !activeGenre ? "text-foreground" : "text-neutral-400 group-hover:text-foreground"
          }`}
        />
        <p className="text-sm font-medium">All Games</p>
      </Link>
      {gameGenres.map((genre) => {
        const isActive = activeGenre === genre.slug;
        return (
          <Link
            key={genre.slug}
            href={`${basePath}&genre=${genre.slug}`}
            className={`group flex flex-col items-center gap-3 rounded-card border p-6 text-center transition ${
              isActive ? "border-foreground" : "border-border-subtle hover:border-foreground"
            }`}
          >
            <ArtGlyph
              kind="gaming"
              className={`h-14 w-14 transition ${
                isActive ? "text-foreground" : "text-neutral-400 group-hover:text-foreground"
              }`}
            />
            <p className="text-sm font-medium">{genre.label}</p>
          </Link>
        );
      })}
    </div>
  );
}
