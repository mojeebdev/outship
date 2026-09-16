import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "outship — prove you ship",
  description:
    "GitHub-verified commits, releases, and streaks — attested onchain on Base so the receipts are yours, not ours.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-cream text-void">
        {children}
      </body>
    </html>
  );
}
