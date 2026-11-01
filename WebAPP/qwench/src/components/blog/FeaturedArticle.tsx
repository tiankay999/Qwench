import Link from "next/link";
import type { Article } from "@/lib/types";

export function FeaturedArticle({
  article,
}: {
  article: Article & { author?: string };
}) {
  return (
    <Link href={`/blog/${article.slug}`} className="block">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 rounded-xl border border-border bg-surface overflow-hidden mb-12">
        <div
          className="h-64 md:h-auto"
          style={{
            background: `linear-gradient(135deg, ${article.gradientFrom}, ${article.gradientTo})`,
          }}
        >
          <div className="p-6 flex items-end h-full">
            <span className="bg-white/20 backdrop-blur-sm text-white text-xs font-bold px-3 py-1 rounded-md uppercase">
              Featured
            </span>
          </div>
        </div>
        <div className="p-6 flex flex-col justify-center">
          <span className="text-xs font-bold text-accent uppercase tracking-wide mb-2">
            {article.categoryLabel}
          </span>
          <h2 className="text-xl font-bold text-text-primary mb-3">
            {article.title}
          </h2>
          <p className="text-sm text-text-secondary mb-4 line-clamp-3">
            {article.description}
          </p>
          <div className="flex items-center gap-3 mb-4">
            {article.author && (
              <>
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent to-mid-navy flex items-center justify-center text-white text-xs font-bold">
                  {article.author
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </div>
                <div>
                  <p className="text-sm font-medium text-text-primary">
                    {article.author}
                  </p>
                  <p className="text-xs text-text-muted">
                    {article.date} · {article.readTime}
                  </p>
                </div>
              </>
            )}
          </div>
          <span className="inline-flex items-center text-sm font-semibold text-danger hover:underline">
            Read full article →
          </span>
        </div>
      </div>
    </Link>
  );
}
