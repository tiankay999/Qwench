import Link from "next/link";
import { Phone } from "lucide-react";
import { HOTLINES } from "@/lib/qwench";
import { QwenchLogo } from "@/components/ui/QwenchLogo";

/**
 * "Information, not advice" appears on every page, which is why it lives here.
 *
 * The prototype called Qwench an "Official Partner" of SEC Ghana. It isn't —
 * regulators are prospects, not partners (docs/spec/README.md, rule 14) — so
 * the Commission appears here only as a source and a hotline.
 */
const columns = [
  {
    title: "Check",
    links: [
      { href: "/search", label: "Run a check" },
      { href: "/report-scheme", label: "Submit a report" },
      { href: "/appeal", label: "Appeal a listing" },
    ],
  },
  {
    title: "Qwench",
    links: [
      { href: "/about", label: "About and data sources" },
      { href: "/community", label: "Reports and reviews" },
      { href: "/blog", label: "Explainers" },
    ],
  },
  {
    title: "Institutions",
    links: [
      { href: "/for-business", label: "For banks and MoMo apps" },
      { href: "/console", label: "Partner console" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-border bg-surface mt-auto">
      <div className="mx-auto max-w-7xl px-4 py-10">
        <div className="grid grid-cols-1 md:grid-cols-[1.5fr_repeat(3,1fr)] gap-8">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <QwenchLogo size={28} />
              <span className="font-bold text-text-primary">Qwench</span>
            </div>
            <p className="text-sm text-text-secondary max-w-xs">
              Ghana&apos;s fraud bureau. We show you what official sources have
              published, with dates and links, so the decision stays yours.
            </p>
          </div>

          {columns.map((col) => (
            <div key={col.title}>
              <p className="text-xs font-bold uppercase tracking-wide text-text-muted mb-3">
                {col.title}
              </p>
              <ul className="space-y-2">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-text-secondary hover:text-accent transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 pt-6 border-t border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            {HOTLINES.map((h) => (
              <a
                key={h.name}
                href={h.href}
                className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-accent transition-colors"
              >
                <Phone className="w-3.5 h-3.5" aria-hidden />
                {h.name} <span className="font-semibold text-text-primary">{h.number}</span>
              </a>
            ))}
          </div>
          <div className="text-xs text-text-muted">
            <p className="font-semibold text-text-secondary">Information, not advice.</p>
            <p className="mt-0.5">© 2026 Qwench · Built for Ghana</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
