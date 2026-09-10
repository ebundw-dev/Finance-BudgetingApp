import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ledger",
  description: "Zero-based budgeting for irregular income.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
