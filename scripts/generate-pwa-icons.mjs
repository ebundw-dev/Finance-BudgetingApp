// Generates the PWA/home-screen icon set from a single inline SVG mark --
// no external design asset, just the app's own dark-sidebar palette
// (--color-base/--color-accent from globals.css). Re-run this script if
// the brand colors ever change; nothing else in the app depends on how
// the mark is drawn, only on the resulting PNG files existing at these
// paths (referenced from src/app/manifest.ts and src/app/layout.tsx).
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const DARK_BASE = "#0f211d";
const ACCENT = "#5cd6ad";

// Three decreasing-width bars -- an abstract "ledger sheet" mark. Plain
// vector shapes only (no text/font dependency), full-bleed solid
// background (no rounded corners baked in -- iOS/Android apply their own
// mask on top of a square source icon), and the bars sit well inside the
// 80%-diameter "safe zone" Android maskable icons require, so one PNG
// works for the plain and maskable manifest entries alike.
function markSvg(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${DARK_BASE}"/>
  <rect x="116" y="170" width="280" height="44" rx="22" fill="${ACCENT}"/>
  <rect x="116" y="234" width="220" height="44" rx="22" fill="${ACCENT}"/>
  <rect x="116" y="298" width="160" height="44" rx="22" fill="${ACCENT}"/>
</svg>`;
}

const projectRoot = path.resolve(import.meta.dirname, "..");
const iconsDir = path.join(projectRoot, "public", "icons");
await mkdir(iconsDir, { recursive: true });

async function render(size, outPath) {
  const svg = Buffer.from(markSvg(size));
  const png = await sharp(svg, { density: 384 }).resize(size, size).png().toBuffer();
  await writeFile(outPath, png);
  console.log(`wrote ${path.relative(projectRoot, outPath)} (${size}x${size})`);
}

await render(192, path.join(iconsDir, "icon-192.png"));
await render(512, path.join(iconsDir, "icon-512.png"));
await render(180, path.join(projectRoot, "public", "apple-touch-icon.png"));
