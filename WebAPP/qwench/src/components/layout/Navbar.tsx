"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageCircle, Menu, X } from "lucide-react";
import { QwenchLogo } from "@/components/ui/QwenchLogo";
import { ThemeToggle } from "./ThemeToggle";
import { WHATSAPP_URL } from "@/lib/channels";
import { cn } from "@/lib/cn";
import { useState } from "react";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/search", label: "Check" },
  { href: "/community", label: "Reports" },
  { href: "/about", label: "About" },
  { href: "/for-business", label: "For business" },
  { href: "/blog", label: "Blog" },
  { href: "/dashboard", label: "Watchlist" },
];

export function Navbar() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-surface/95 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-4 flex items-center justify-between h-16">
        <div className="flex items-center gap-6 min-w-0">
          <Link href="/" className="flex items-center gap-2 flex-shrink-0">
            <QwenchLogo size={32} />
            <span className="text-lg font-bold text-text-primary">Qwench</span>
          </Link>

          <div className="hidden lg:flex items-center gap-0.5">
            {navLinks.map((link) => {
              const isActive =
                link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "px-3 py-2 text-sm font-medium rounded-lg transition-colors min-h-[44px] flex items-center whitespace-nowrap",
                    isActive
                      ? "text-text-primary border-b-2 border-accent rounded-none"
                      : "text-text-secondary hover:text-text-primary",
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <ThemeToggle />
          {WHATSAPP_URL && (
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-2 bg-accent text-primary font-semibold text-sm px-4 py-2.5 rounded-full hover:brightness-110 transition-all min-h-[44px]"
            >
              <MessageCircle className="w-4 h-4" aria-hidden />
              Check on WhatsApp
            </a>
          )}
          <button
            className="lg:hidden p-2 min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
          >
            {menuOpen ? (
              <X className="w-5 h-5 text-text-primary" aria-hidden />
            ) : (
              <Menu className="w-5 h-5 text-text-primary" aria-hidden />
            )}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="lg:hidden border-t border-border bg-surface px-4 py-2">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="block py-3 text-sm font-medium text-text-secondary hover:text-text-primary"
            >
              {link.label}
            </Link>
          ))}
          {WHATSAPP_URL && (
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="block py-3 text-sm font-medium text-accent"
            >
              Check on WhatsApp
            </a>
          )}
        </div>
      )}
    </nav>
  );
}
