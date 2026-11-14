import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import "./globals.css";
import { SITE_URL, jsonLd, siteStructuredData } from "@/lib/structured-data";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "outship — prove you ship",
  description:
    "GitHub-verified commits, releases, and streaks — attested onchain on Base so the receipts are yours, not ours.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-cream text-void">
        <script
          type="application/ld+json"
          // Static data from src/lib/structured-data.ts, never user input.
          dangerouslySetInnerHTML={{ __html: jsonLd(siteStructuredData) }}
        />
        {children}
      </body>
    </html>
  );
}
