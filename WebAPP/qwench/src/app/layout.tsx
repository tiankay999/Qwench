import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import { ThemeProvider } from "next-themes";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { FloatingWhatsApp } from "@/components/layout/FloatingWhatsApp";
import { PublicOnly } from "@/components/layout/PublicOnly";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "Qwench — Verify Before You Invest",
  description:
    "Check any company, token, or investment in Ghana before you put in a single cedi.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} h-full`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col antialiased">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          <Suspense>
            <PublicOnly>
              <Navbar />
            </PublicOnly>
          </Suspense>
          <main className="flex-1">{children}</main>
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
