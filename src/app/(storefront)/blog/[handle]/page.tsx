import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/breadcrumb";
import { getArticleByHandle } from "@/lib/shopify";
import { truncate } from "@/lib/format";
import { buildArticleJsonLd } from "@/lib/structured-data";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

type ArticlePageProps = {
  params: Promise<{ handle: string }>;
};

export async function generateMetadata({ params }: ArticlePageProps): Promise<Metadata> {
  const { handle } = await params;
  const article = await getArticleByHandle(handle);
  if (!article) return {};

  const description = truncate(article.excerpt, 155);
  return {
    title: article.title,
    description,
    alternates: { canonical: `/blog/${handle}` },
    openGraph: {
      title: article.title,
      description,
      images: article.image ? [{ url: article.image.url }] : undefined,
    },
  };
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const { handle } = await params;
  const article = await getArticleByHandle(handle);

  if (!article) {
    notFound();
  }

  const articleJsonLd = buildArticleJsonLd(article, handle);

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <Breadcrumb
        items={[
          { label: "Home", href: "/" },
          { label: "Blog", href: "/blog" },
          { label: article.title },
        ]}
      />

      <div className="mx-auto mt-6 max-w-2xl">
        {article.tags[0] && (
          <p className="text-sm font-medium uppercase tracking-wide text-accent">{article.tags[0]}</p>
        )}
        <h1 className="mt-2 text-title sm:text-display">{article.title}</h1>
        <p className="mt-3 text-sm text-neutral-500">
          {formatDate(article.publishedAt)}
          {article.author && ` · ${article.author}`}
        </p>
      </div>

      {article.image && (
        <div className="relative mx-auto mt-8 aspect-[16/9] max-w-3xl overflow-hidden rounded-card bg-neutral-100">
          <Image
            src={article.image.url}
            alt={article.image.altText ?? article.title}
            fill
            sizes="(min-width: 1024px) 48rem, 100vw"
            className="object-cover"
            priority
          />
        </div>
      )}

      <div
        className="mx-auto mt-10 max-w-prose text-neutral-600 [&_a]:text-accent [&_a]:underline [&_a]:underline-offset-2 [&_a]:hover:opacity-80 [&_li]:mb-1 [&_p]:mb-4 [&_p:last-child]:mb-0 [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-5"
        dangerouslySetInnerHTML={{ __html: article.contentHtml }}
      />
    </div>
  );
}
