import type { MetadataRoute } from "next";

// Next's manifest.ts special file -- auto-served at /manifest.webmanifest
// and auto-linked from <head> (see layout.tsx), the App Router's built-in
// equivalent of a hand-written public/manifest.json. Colors are the
// existing dark sidebar palette from globals.css's .sidebar-dark block
// (--color-base / --color-accent), not the light main-canvas palette --
// this is what a viewer sees on the splash/launch screen and in OS
// chrome, and the dark sidebar is Ledger's most recognizable surface.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Ledger",
    short_name: "Ledger",
    description: "Zero-based budgeting for irregular income.",
    start_url: "/",
    display: "standalone",
    background_color: "#0f211d",
    theme_color: "#0f211d",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
