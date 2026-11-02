import Link from "next/link";
import { articles, featuredArticle } from "@/lib/mock-data";
import { ArrowLeft } from "lucide-react";

export function generateStaticParams() {
  return [featuredArticle, ...articles].map((a) => ({ slug: a.slug }));
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const allArticles = [featuredArticle, ...articles];
  const article = allArticles.find((a) => a.slug === slug);

  if (!article) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-text-primary mb-4">
          Article not found
        </h1>
        <Link href="/blog" className="text-accent hover:underline">
          Back to blog
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link
        href="/blog"
        className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-accent mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to blog
      </Link>

      <div
        className="w-full h-64 rounded-xl mb-8"
        style={{
          background: `linear-gradient(135deg, ${article.gradientFrom}, ${article.gradientTo})`,
        }}
      />

      <span className="text-xs font-bold text-accent uppercase tracking-wide">
        {article.categoryLabel}
      </span>
      <h1 className="text-3xl font-extrabold text-text-primary mt-2 mb-4">
        {article.title}
      </h1>
      <p className="text-sm text-text-muted mb-8">
        {article.date} · {article.readTime}
      </p>

      <div className="prose max-w-none text-text-secondary">
        <p>{article.description}</p>
        <p className="mt-4">
          This is a placeholder article page. In production, full article content
          would be loaded from a CMS or database.
        </p>
      </div>
    </div>
  );
}
