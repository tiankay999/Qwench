import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { ARTICLES } from "@/lib/content";
import { ChannelsCTA } from "@/components/layout/ChannelsCTA";

export function generateStaticParams() {
  return ARTICLES.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = ARTICLES.find((a) => a.slug === slug);
  if (!article) return { title: "Not found — Qwench" };
  return { title: `${article.title} — Qwench`, description: article.description };
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = ARTICLES.find((a) => a.slug === slug);
  if (!article) notFound();

  const more = ARTICLES.filter((a) => a.slug !== article.slug).slice(0, 3);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link
        href="/blog"
        className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-accent mb-6"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden />
        All explainers
      </Link>

      <div
        className="w-full h-40 rounded-xl mb-8"
        style={{
          background: `linear-gradient(135deg, ${article.gradientFrom}, ${article.gradientTo})`,
        }}
      />

      <span className="text-xs font-bold text-accent uppercase tracking-wide">
        {article.category}
      </span>
      <h1 className="text-3xl font-extrabold text-text-primary mt-2 mb-3">{article.title}</h1>
      <p className="text-sm text-text-muted mb-8">
        {article.date} · {article.readTime}
      </p>

      <div className="space-y-5">
        <p className="text-lg text-text-primary leading-relaxed">{article.description}</p>
        {article.body?.map((para) => (
          <p key={para.slice(0, 40)} className="text-text-secondary leading-relaxed">
            {para}
          </p>
        ))}
      </div>

      <p className="text-xs text-text-muted mt-10 pt-6 border-t border-border">
        Written by the Qwench team. This is background, not advice, and it is not a
        statement about any particular company. SEC Ghana 0800 100 065. Cyber Security
        Authority 292.
      </p>

      {more.length > 0 && (
        <section className="mt-12">
          <h2 className="text-lg font-bold text-text-primary mb-4">Read next</h2>
          <ul className="space-y-3">
            {more.map((a) => (
              <li key={a.slug}>
                <Link
                  href={`/blog/${a.slug}`}
                  className="block rounded-xl border border-border bg-surface p-4 hover:border-accent transition-colors"
                >
                  <p className="text-xs font-bold text-accent uppercase tracking-wide mb-1">
                    {a.category}
                  </p>
                  <p className="font-semibold text-text-primary text-sm">{a.title}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ChannelsCTA />
    </div>
  );
}
