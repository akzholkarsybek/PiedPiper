import type { Metadata, Viewport } from "next";
import { Inter, Newsreader } from "next/font/google";
import "./globals.css";
import "./design-system.css";
import "./screens.css";

// Self-hosted at build time by next/font: no font requests go to Google from
// the visitor's browser.
const display = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
  variable: "--font-display",
  display: "swap",
});
const ui = Inter({
  subsets: ["latin"],
  variable: "--font-ui",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default:
      "Pied Piper — Your AI finds the people. You build the relationship.",
    template: "%s | Pied Piper",
  },
  description:
    "Your AI finds the people. You build the relationship. Thoughtful introductions, AI matchmakers that compare notes with consent, and real first-date ideas.",
};
export const viewport: Viewport = {
  themeColor: "#fbf7f1",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${display.variable} ${ui.variable}`}
    >
      <body>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
