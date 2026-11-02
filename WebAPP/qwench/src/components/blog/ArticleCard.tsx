import Link from "next/link";
import type { Article } from "@/lib/content";

export function ArticleCard({ article }: { article: Article }) {
  return (
    <Link href={`/blog/${article.slug}`} className="block group">
      <div className="rounded-xl border border-border bg-surface overflow-hidden hover:border-accent hover:shadow-md transition-all h-full flex flex-col">
        <div
          className="h-32 flex items-start p-4"
          style={{
            background: `linear-gradient(135deg, ${article.gradientFrom}, ${article.gradientTo})`,
          }}
        >
          <span className="bg-black/25 backdrop-blur-sm text-white text-xs font-bold px-2.5 py-1 rounded-md uppercase tracking-wide">
            {article.category}
          </span>
        </div>
        <div className="p-5 flex flex-col flex-1">
          <h3 className="font-bold text-text-primary text-sm mb-2 group-hover:text-accent transition-colors">
            {article.title}
          </h3>
          <p className="text-xs text-text-secondary leading-relaxed mb-4">
            {article.description}
          </p>
          <p className="text-xs text-text-muted mt-auto">
            {article.date} · {article.readTime}
          </p>
        </div>
      </div>
    </Link>
  );
}
