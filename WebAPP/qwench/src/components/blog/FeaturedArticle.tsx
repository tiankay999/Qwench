import Link from "next/link";
import type { Article } from "@/lib/content";

export function FeaturedArticle({ article }: { article: Article }) {
  return (
    <Link href={`/blog/${article.slug}`} className="block group">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-0 rounded-xl border border-border bg-surface overflow-hidden mb-12 hover:border-accent transition-colors">
        <div
          className="h-48 md:h-auto flex items-end p-6"
          style={{
            background: `linear-gradient(135deg, ${article.gradientFrom}, ${article.gradientTo})`,
          }}
        >
          <span className="bg-black/25 backdrop-blur-sm text-white text-xs font-bold px-3 py-1 rounded-md uppercase tracking-wide">
            Start here
          </span>
        </div>
        <div className="p-6 md:p-8 flex flex-col justify-center">
          <span className="text-xs font-bold text-accent uppercase tracking-wide mb-2">
            {article.category}
          </span>
          <h2 className="text-xl font-bold text-text-primary mb-3 group-hover:text-accent transition-colors">
            {article.title}
          </h2>
          <p className="text-sm text-text-secondary leading-relaxed mb-4">
            {article.description}
          </p>
          <p className="text-xs text-text-muted mb-4">
            {article.date} · {article.readTime}
          </p>
          <span className="inline-flex items-center text-sm font-semibold text-accent">
            Read it →
          </span>
        </div>
      </div>
    </Link>
  );
}
