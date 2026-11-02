"use client";

import { useState } from "react";
import { ARTICLES, BLOG_CATEGORIES, FEATURED_ARTICLE } from "@/lib/content";
import { FeaturedArticle } from "@/components/blog/FeaturedArticle";
import { ArticleCard } from "@/components/blog/ArticleCard";
import { ChannelsCTA } from "@/components/layout/ChannelsCTA";
import { Chip } from "@/components/ui/Chip";

export default function BlogPage() {
  const [active, setActive] = useState(BLOG_CATEGORIES[0]);

  const rest = ARTICLES.filter((a) => a.slug !== FEATURED_ARTICLE.slug);
  const shown = active === BLOG_CATEGORIES[0] ? rest : rest.filter((a) => a.category === active);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <p className="text-xs font-bold text-accent uppercase tracking-wide mb-1">
        Qwench explainers
      </p>
      <h1 className="text-2xl md:text-3xl font-bold text-text-primary mb-2">
        How to read what a regulator published
      </h1>
      <p className="text-sm text-text-secondary mb-8 max-w-xl">
        Short pieces on what a notice is, what a licence does and doesn&apos;t cover, and
        what to do in the two minutes before a transfer goes out.
      </p>

      <div className="flex gap-2 flex-wrap mb-8">
        {BLOG_CATEGORIES.map((cat) => (
          <Chip key={cat} label={cat} active={active === cat} onClick={() => setActive(cat)} />
        ))}
      </div>

      <FeaturedArticle article={FEATURED_ARTICLE} />

      <h2 className="text-lg font-bold text-text-primary mb-6">
        {active === BLOG_CATEGORIES[0] ? "More explainers" : active}
      </h2>
      {shown.length ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {shown.map((article) => (
            <ArticleCard key={article.slug} article={article} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-text-muted">Nothing under this heading yet.</p>
      )}

      <ChannelsCTA />
    </div>
  );
}
