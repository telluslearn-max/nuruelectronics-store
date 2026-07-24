import type { Metadata } from "next";
import { BlogCard } from "@/components/blog-card";
import { getArticles } from "@/lib/shopify";

export const metadata: Metadata = {
  title: "Blog",
  description: "Guides and news from NURU on picking, using, and caring for your electronics.",
  alternates: { canonical: "/blog" },
};

export default async function BlogPage() {
  const articles = await getArticles();

  return (
    <div>
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-title sm:text-display">NURU Blog</h1>
        <p className="mt-2 text-neutral-500">Guides and news to help you choose and use your electronics.</p>
      </div>

      <div className="mt-12">
        {articles.length === 0 ? (
          <p className="text-center text-neutral-500">No posts yet — check back soon.</p>
        ) : (
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {articles.map((article) => (
              <BlogCard key={article.id} article={article} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
