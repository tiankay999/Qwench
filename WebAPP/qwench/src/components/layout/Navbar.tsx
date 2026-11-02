"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageCircle, Menu, X } from "lucide-react";
import { QwenchLogo } from "@/components/ui/QwenchLogo";
import { ThemeToggle } from "./ThemeToggle";
import { cn } from "@/lib/cn";
import { useState } from "react";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/community", label: "Community" },
  { href: "/blog", label: "Blog" },
  { href: "/dashboard", label: "Dashboard" },
];

export function Navbar() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-surface/95 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-4 flex items-center justify-between h-16">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2">
            <QwenchLogo size={32} />
            <span className="text-lg font-bold text-text-primary">Qwench</span>
          </Link>

          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const isActive =
                link.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "px-3 py-2 text-sm font-medium rounded-lg transition-colors min-h-[44px] flex items-center",
                    isActive
                      ? "text-text-primary border-b-2 border-accent rounded-none"
                      : "text-text-secondary hover:text-text-primary"
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <a
            href="https://wa.me/233XXXXXXXXX"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex items-center gap-2 bg-accent text-primary font-semibold text-sm px-4 py-2.5 rounded-full hover:brightness-110 transition-all min-h-[44px]"
          >
            <MessageCircle className="w-4 h-4" />
            Connect WhatsApp
          </a>
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-mid-navy flex items-center justify-center text-white text-xs font-bold">
            A
          </div>
          <button
            className="md:hidden p-2 min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            {menuOpen ? (
              <X className="w-5 h-5 text-text-primary" />
            ) : (
              <Menu className="w-5 h-5 text-text-primary" />
            )}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="md:hidden border-t border-border bg-surface px-4 py-2">
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
          <a
            href="https://wa.me/233XXXXXXXXX"
            target="_blank"
            rel="noopener noreferrer"
            className="block py-3 text-sm font-medium text-accent"
          >
            Connect WhatsApp
          </a>
        </div>
      )}
    </nav>
  );
}
