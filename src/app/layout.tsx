import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: {
    default: "Pied Piper — A little less searching. A lot more connection.",
    template: "%s | Pied Piper",
  },
  description:
    "Your AI finds the people. You build the relationship. Thoughtful introductions, meaningful questions, and a little more possibility.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
