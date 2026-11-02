import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans, Roboto_Mono } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import { ThemeProvider } from "next-themes";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { FloatingWhatsApp } from "@/components/layout/FloatingWhatsApp";
import { PublicOnly } from "@/components/layout/PublicOnly";

/* Three families, three jobs. Headings, reading, and data — see DESIGN.md.
   Only the weights the system actually defines are requested; the previous
   build pulled six Inter weights and used three. */
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["700", "800"],
  display: "swap",
});

/* Evidence face. Tabular figures so a column of notice dates aligns, and a
   slashed zero so a wallet address can be transcribed without a guess. */
const robotoMono = Roboto_Mono({
  variable: "--font-roboto-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

/* No instruction and no verdict, including here. The previous title read
   "Verify Before You Invest", which is advice, and advice is Rule 1. */
export const metadata: Metadata = {
  title: "Qwench — Ghana's fraud bureau",
  description:
    "Check a name, number, link or wallet against what Ghana's regulators have published. Every claim carries its publisher, its date and a link to the notice.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jakarta.variable} ${robotoMono.variable} h-full`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col antialiased">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-text-primary focus:shadow-floating"
          >
            Skip to content
          </a>
          <Suspense>
            <PublicOnly>
              <Navbar />
            </PublicOnly>
          </Suspense>
          <main id="main" className="flex-1">
            {children}
          </main>
          <Suspense>
            <PublicOnly>
              <Footer />
              <FloatingWhatsApp />
            </PublicOnly>
          </Suspense>
        </ThemeProvider>
      </body>
    </html>
  );
}
