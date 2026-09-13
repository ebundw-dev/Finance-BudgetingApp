// Generates mobile/assets/*.png placeholders for the Expo app from the
// same inline SVG mark used by scripts/generate-pwa-icons.mjs, so the
// native app icon/splash match the web app's dark-sidebar palette
// (--color-base/--color-accent from globals.css). This intentionally
// imports `sharp` from the ROOT project's node_modules (run via `node
// scripts/generate-mobile-icons.mjs` from the repo root) rather than
// adding sharp as a mobile/ dependency -- it's a one-off asset-generation
// script, not something the Expo app itself needs at runtime.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const DARK_BASE = "#0f211d";
const ACCENT = "#5cd6ad";

function markSvg(size, { padFraction = 0 } = {}) {
  // Same three-bar mark as the PWA icons, optionally padded down (as a
  // fraction of the canvas) to keep it inside Android's adaptive-icon
  // safe zone when placed on its own transparent-safe foreground layer.
  const scale = 1 - padFraction * 2;
  const offset = (512 * padFraction) / scale;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${DARK_BASE}"/>
  <g transform="translate(${offset}, ${offset}) scale(${scale})">
    <rect x="116" y="170" width="280" height="44" rx="22" fill="${ACCENT}"/>
    <rect x="116" y="234" width="220" height="44" rx="22" fill="${ACCENT}"/>
    <rect x="116" y="298" width="160" height="44" rx="22" fill="${ACCENT}"/>
  </g>
</svg>`;
}

function foregroundSvg(size) {
  // Android adaptive icon foreground layer: transparent background, mark
  // shrunk toward the center so it survives launcher masking/cropping.
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <g transform="translate(96, 96) scale(0.625)">
    <rect x="116" y="170" width="280" height="44" rx="22" fill="${ACCENT}"/>
    <rect x="116" y="234" width="220" height="44" rx="22" fill="${ACCENT}"/>
    <rect x="116" y="298" width="160" height="44" rx="22" fill="${ACCENT}"/>
  </g>
</svg>`;
}

function monochromeSvg(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <g transform="translate(96, 96) scale(0.625)">
    <rect x="116" y="170" width="280" height="44" rx="22" fill="#ffffff"/>
    <rect x="116" y="234" width="220" height="44" rx="22" fill="#ffffff"/>
    <rect x="116" y="298" width="160" height="44" rx="22" fill="#ffffff"/>
  </g>
</svg>`;
}

const projectRoot = path.resolve(import.meta.dirname, "..");
const assetsDir = path.join(projectRoot, "mobile", "assets");
await mkdir(assetsDir, { recursive: true });

async function renderFrom(svgString, size, outPath, { transparent = false } = {}) {
  const svg = Buffer.from(svgString);
  let img = sharp(svg, { density: 384 }).resize(size, size);
  if (!transparent) img = img.flatten({ background: DARK_BASE });
  const png = await img.png().toBuffer();
  await writeFile(outPath, png);
  console.log(`wrote ${path.relative(projectRoot, outPath)} (${size}x${size})`);
}

// Main app icon (square, opaque, iOS wants no pre-baked rounding).
await renderFrom(markSvg(1024), 1024, path.join(assetsDir, "icon.png"));

// Splash screen image: expo-splash-screen composites this centered over
// its own solid backgroundColor, so keep this transparent and just the
// mark, generously padded.
await renderFrom(
  markSvg(1024, { padFraction: 0.32 }),
  1024,
  path.join(assetsDir, "splash-icon.png"),
);

// Android adaptive icon layers.
await renderFrom(markSvg(1024), 1024, path.join(assetsDir, "android-icon-background.png"));
await renderFrom(foregroundSvg(1024), 1024, path.join(assetsDir, "android-icon-foreground.png"), {
  transparent: true,
});
await renderFrom(monochromeSvg(1024), 1024, path.join(assetsDir, "android-icon-monochrome.png"), {
  transparent: true,
});

// Web favicon (used only if `expo start --web` is ever run).
await renderFrom(markSvg(48), 48, path.join(assetsDir, "favicon.png"));
