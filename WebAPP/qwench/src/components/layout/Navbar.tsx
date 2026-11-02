"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageCircle, Menu, X } from "lucide-react";
import { QwenchLogo } from "@/components/ui/QwenchLogo";
import { ThemeToggle } from "./ThemeToggle";
import { WHATSAPP_URL } from "@/lib/channels";
import { cn } from "@/lib/cn";
import { useState } from "react";

/**
 * The masthead is the register's cover, so it keeps its dark ground in both
 * themes rather than flipping with the page. That also removes the seam where
 * a white bar used to sit on top of a dark hero.
 *
 * The current item is marked by a Beam underline as well as by colour, so it
 * survives greyscale and forced-colours mode.
 */
const navLinks = [
  { href: "/", label: "Home" },
  { href: "/search", label: "Check" },
  // was "Reports", which pointed at a page that deliberately has no report
  // feed — Rule 5 means a report never becomes a public result.
  { href: "/community", label: "Reporting" },
  { href: "/about", label: "About" },
  { href: "/for-business", label: "For business" },
  { href: "/blog", label: "Blog" },
  { href: "/dashboard", label: "Watchlist" },
];

export function Navbar() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 bg-[#1f2a44]">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <div className="flex min-w-0 items-center gap-7">
          <Link href="/" className="flex flex-shrink-0 items-center gap-2.5">
            <QwenchLogo size={30} />
            <span className="font-display text-xl font-extrabold tracking-[-0.03em] text-[#F1F5F9]">
              Qwench
            </span>
          </Link>

          <div className="hidden items-center gap-1 lg:flex">
            {navLinks.map((link) => {
              const isActive =
                link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex min-h-[44px] items-center whitespace-nowrap border-b-2 px-3 text-[15px] font-semibold",
                    "transition-colors duration-150 ease-out-expo",
                    isActive
                      ? "border-beam text-[#F1F5F9]"
                      : "border-transparent text-[#A9B8CC] hover:text-[#F1F5F9]",
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="flex flex-shrink-0 items-center gap-2">
          <ThemeToggle />
          {WHATSAPP_URL && (
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "hidden min-h-[44px] items-center gap-2 rounded-[10px] bg-accent-bright px-4 text-sm font-semibold text-white sm:inline-flex",
                "transition-colors duration-150 ease-out-expo hover:bg-[#2b7dff]",
              )}
            >
              <MessageCircle className="size-4" strokeWidth={1.75} aria-hidden />
              Check on WhatsApp
            </a>
          )}
          <button
            className="flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center text-[#F1F5F9] lg:hidden"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
          >
            {menuOpen ? (
              <X className="size-5" strokeWidth={1.75} aria-hidden />
            ) : (
              <Menu className="size-5" strokeWidth={1.75} aria-hidden />
            )}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="border-t border-white/10 bg-[#1f2a44] px-4 pb-3 lg:hidden">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="flex min-h-[48px] items-center text-[15px] font-semibold text-[#A9B8CC] hover:text-[#F1F5F9]"
            >
              {link.label}
            </Link>
          ))}
          {WHATSAPP_URL && (
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-[48px] items-center text-[15px] font-semibold text-beam"
            >
              Check on WhatsApp
            </a>
          )}
        </div>
      )}
    </nav>
  );
}
