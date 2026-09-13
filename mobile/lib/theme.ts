// Mirrors the web app's design tokens (src/app/globals.css), specifically
// the .sidebar-dark scope -- the app's own dark palette -- rather than the
// light main-canvas tokens, since a native mobile app reads better dark
// throughout. Keep these in sync by hand if globals.css's palette changes;
// there's no shared package between the two apps to enforce it.
export const colors = {
  base: "#0f211d",
  surface: "#15302a",
  surfaceHover: "#1b3b33",
  border: "#24443c",
  text: "#f3f7f5",
  textSecondary: "#9fb6af",
  textMuted: "#6e877f",
  accent: "#5cd6ad",
  accentHover: "#49c09a",
  onAccent: "#0f211d",
  success: "#2e9e6b",
  danger: "#d9564f",
  warning: "#d79a2c",
  info: "#4c7ebf",
} as const;

export type Tone = "default" | "success" | "danger" | "accent" | "warning" | "info";

export const toneText: Record<Tone, string> = {
  default: colors.text,
  success: colors.success,
  danger: colors.danger,
  accent: colors.accent,
  warning: colors.warning,
  info: colors.info,
};

// 12% alpha, matching the web app's bg-{tone}/12 icon-badge treatment.
export const toneBadgeBg: Record<Tone, string> = {
  default: `${colors.textSecondary}1f`,
  success: `${colors.success}1f`,
  danger: `${colors.danger}1f`,
  accent: `${colors.accent}1f`,
  warning: `${colors.warning}1f`,
  info: `${colors.info}1f`,
};
