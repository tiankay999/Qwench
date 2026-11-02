import type { Metadata } from "next";
import { ConsoleShell } from "@/components/console/ConsoleShell";

// Every screen is behind a login and rendered in the browser, so there's nothing to
// prerender. Each page sets this too, because it applies per segment.
export const instant = false;

export const metadata: Metadata = {
  title: "Qwench Console",
  description: "Lookups, payment checks, the daily feed, API keys and reviews for Qwench members.",
  robots: { index: false },
};

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  return <ConsoleShell>{children}</ConsoleShell>;
}
