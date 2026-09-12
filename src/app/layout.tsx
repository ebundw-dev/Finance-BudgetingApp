import type { Metadata, Viewport } from "next";
import { Fraunces } from "next/font/google";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
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
  // manifest.ts (App Router special file) is auto-linked by Next already;
  // these cover what it doesn't -- the iOS-specific home-screen behavior
  // (standalone launch, no Safari chrome) and the apple-touch-icon, which
  // iOS looks for via a plain <link>, not the manifest's icons array.
  appleWebApp: {
    capable: true,
    statusBarStyle: "black",
    title: "Ledger",
  },
  icons: {
    apple: "/apple-touch-icon.png",
  },
};

// themeColor lives on the separate viewport export (not metadata) as of
// Next 14+ -- this is what colors the OS/browser chrome around the page,
// matching the dark sidebar palette the manifest's background_color also
// uses.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f211d",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={fraunces.variable}>
      <body className="min-h-screen bg-base text-text antialiased">
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
