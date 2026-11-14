import type { Metadata, Viewport } from "next";
import "@fontsource-variable/geist";
import "@fontsource/instrument-serif/400.css";
import "@fontsource/instrument-serif/400-italic.css";
import Link from "next/link";
import { Suspense } from "react";
import { StatusBadge } from "@/components/StatusBadge";
import { NavLinks } from "@/components/NavLinks";
import { ConsentGate } from "@/components/ConsentGate";
import { Heart, Shield } from "@/components/icons";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wingmate: your AI goes on the first date",
  description:
    "Your AI agent goes on the awkward first date for you, money talk included. You only show up for the ones worth your evening.",
};

export const viewport: Viewport = {
  themeColor: "#fbf6ef",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <header className="w-full border-b border-line/70 glass sticky top-0 z-30">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 h-16 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 group" aria-label="Wingmate home">
              <span className="w-8 h-8 rounded-full bg-grad text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                <Heart size={16} filled />
              </span>
              <span className="display text-[1.7rem] leading-none">Wingmate</span>
            </Link>
            <nav className="flex items-center gap-2.5 text-sm">
              <StatusBadge />
              <Suspense fallback={null}>
                <NavLinks />
              </Suspense>
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="mx-auto max-w-6xl w-full px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted">
          <span className="inline-flex items-center gap-1.5">
            <Shield size={14} /> Agents never lie about you and never reveal what you mark private.
          </span>
          <span>Humans make every real decision.</span>
        </footer>
        <ConsentGate />
      </body>
    </html>
  );
}
