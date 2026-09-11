import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ledger",
  description: "Zero-based budgeting for irregular income.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-base text-text antialiased">{children}</body>
    </html>
  );
}
