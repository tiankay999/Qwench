import Link from "next/link";

export function RelatedSearches({ searches }: { searches: string[] }) {
  return (
    <div>
      <h3 className="text-xs text-text-muted uppercase tracking-wide font-medium mb-3">
        Related Searches
      </h3>
      <div className="flex flex-wrap gap-2">
        {searches.map((s) => {
          const slug = s.toLowerCase().replace(/\s+/g, "-");
          return (
            <Link
              key={s}
              href={`/report/${slug}`}
              className="px-3 py-1.5 rounded-full bg-surface-alt text-xs font-medium text-text-secondary hover:bg-border transition-colors min-h-[36px] flex items-center"
            >
              {s}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
