import Image from "next/image";
import Link from "next/link";
import type { Article } from "@/lib/shopify/types";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function BlogCard({ article }: { article: Article }) {
  return (
    <Link href={`/blog/${article.handle}`} className="group block">
      <div className="relative aspect-[4/3] overflow-hidden rounded-card bg-neutral-100">
        {article.image ? (
          <Image
            src={article.image.url}
            alt={article.image.altText ?? article.title}
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-neutral-300">
            <svg viewBox="0 0 24 24" className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <path d="M3 15l5-5 4 4 5-5 4 4" />
            </svg>
          </div>
        )}
        <span className="absolute left-3 top-3 rounded-control bg-background/95 px-2.5 py-1 text-xs font-medium shadow-sm">
          {formatDate(article.publishedAt)}
        </span>
      </div>
      <div className="mt-3 space-y-1">
        {article.tags[0] && (
          <p className="text-xs font-medium uppercase tracking-wide text-accent">{article.tags[0]}</p>
        )}
        <h3 className="line-clamp-2 font-medium leading-snug">{article.title}</h3>
        <p className="line-clamp-2 text-sm text-neutral-500">{article.excerpt}</p>
        <div className="flex items-center justify-between pt-1">
          {article.author && <span className="text-xs text-neutral-400">{article.author}</span>}
          <span className="text-sm font-medium text-accent group-hover:opacity-80">Continue reading</span>
        </div>
      </div>
    </Link>
  );
}
