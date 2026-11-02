import Link from "next/link";
import type { Article } from "@/lib/types";

export function ArticleCard({ article }: { article: Article }) {
  return (
    <Link href={`/blog/${article.slug}`} className="block group">
      <div className="rounded-xl border border-border bg-surface overflow-hidden hover:shadow-md transition-shadow">
        <div
          className="h-40"
          style={{
            background: `linear-gradient(135deg, ${article.gradientFrom}, ${article.gradientTo})`,
          }}
        >
          <div className="p-4">
            <span className="bg-white/20 backdrop-blur-sm text-white text-xs font-bold px-2.5 py-1 rounded-md uppercase">
              {article.categoryLabel}
            </span>
          </div>
        </div>
        <div className="p-4">
          <p className="text-xs font-medium text-accent uppercase tracking-wide mb-1">
            {article.category}
          </p>
          <h3 className="font-bold text-text-primary text-sm mb-2 group-hover:text-accent transition-colors line-clamp-2">
            {article.title}
          </h3>
          <p className="text-xs text-text-secondary mb-3 line-clamp-2">
            {article.description}
          </p>
          <p className="text-xs text-text-muted">
            {article.date} · {article.readTime}
          </p>
        </div>
      </div>
    </Link>
  );
}
