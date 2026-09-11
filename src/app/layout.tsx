import type { Metadata } from "next";
import { Fraunces } from "next/font/google";
import "./globals.css";

// A warm editorial serif for page headlines only (see PageHeader) -- the
// rest of the UI stays on the system sans stack for density/legibility.
// The two-typeface pairing is what gives headlines a distinct personality
// instead of just being a bigger weight of the same body font.
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Ledger",
  description: "Zero-based budgeting for irregular income.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={fraunces.variable}>
      <body className="min-h-screen bg-base text-text antialiased">{children}</body>
    </html>
  );
}
