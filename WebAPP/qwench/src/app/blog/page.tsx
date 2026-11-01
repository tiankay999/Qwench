"use client";

import { useState } from "react";
import { articles, featuredArticle } from "@/lib/mock-data";
import { FeaturedArticle } from "@/components/blog/FeaturedArticle";
import { ArticleCard } from "@/components/blog/ArticleCard";
import { NewsletterCTA } from "@/components/blog/NewsletterCTA";
import { Chip } from "@/components/ui/Chip";

const tabs = ["All posts", "Scam Alerts", "Education", "Case Studies", "SEC Updates"];

export default function BlogPage() {
  const [activeTab, setActiveTab] = useState("All posts");

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <p className="text-xs font-bold text-accent uppercase tracking-wide mb-1">
        QWENCH BLOG
      </p>
      <h1 className="text-2xl md:text-3xl font-bold text-text-primary mb-1">
        Investor insights & scam alerts
      </h1>
      <p className="text-sm text-text-secondary mb-8">
        Expert analysis to help you invest smarter in Ghana.
      </p>

      <div className="flex gap-2 flex-wrap mb-8">
        {tabs.map((tab) => (
          <Chip
            key={tab}
            label={tab}
            active={activeTab === tab}
            onClick={() => setActiveTab(tab)}
          />
        ))}
      </div>

      <FeaturedArticle article={featuredArticle} />

      <h2 className="text-lg font-bold text-text-primary mb-6">
        Latest articles
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {articles.map((article) => (
          <ArticleCard key={article.slug} article={article} />
        ))}
      </div>

      <NewsletterCTA />
    </div>
  );
}
