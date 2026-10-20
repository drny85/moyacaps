/**
 * Design tokens and shared styles for every email (one dark look, one font stack). Templates
 * compose these instead of defining their own colors and fonts, so the whole set stays
 * consistent and a redesign is a change here.
 */
import type { CSSProperties } from "react";

export const colors = {
  background: "#0C0A09",
  surface: "#18181B",
  surfaceRaised: "#1F1F23",
  border: "#27272A",
  text: "#F5F5F4",
  body: "#D4D4D8",
  muted: "#A1A1AA",
  subtle: "#71717A",
  gold: "#D4AF37",
  goldSoft: "rgba(212, 175, 55, 0.12)",
  goldBorder: "rgba(212, 175, 55, 0.3)",
  success: "#10B981",
  warning: "#F59E0B",
  danger: "#EF4444",
  info: "#3B82F6",
} as const;

export const fonts = {
  sans: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  /** Order numbers, amounts and tracking codes only. */
  mono: "'SFMono-Regular', Menlo, Consolas, 'Liberation Mono', monospace",
} as const;

export const styles = {
  card: {
    backgroundColor: colors.surface,
    borderRadius: "14px",
    border: `1px solid ${colors.border}`,
    padding: "24px",
    margin: "16px 0 20px 0",
  },
  heroSection: { textAlign: "center", padding: "8px 16px 8px 16px" },
  badge: {
    display: "inline-block",
    fontSize: "10px",
    fontWeight: "700",
    letterSpacing: "2px",
    textTransform: "uppercase",
    color: colors.gold,
    backgroundColor: colors.goldSoft,
    border: `1px solid ${colors.goldBorder}`,
    borderRadius: "9999px",
    padding: "4px 12px",
    margin: "0 0 14px 0",
  },
  heading: { fontSize: "22px", lineHeight: "30px", fontWeight: "700", color: colors.text, margin: "0 0 10px 0" },
  subheading: { fontSize: "15px", fontWeight: "700", color: colors.text, margin: "0 0 12px 0" },
  paragraph: { fontSize: "14px", lineHeight: "22px", color: colors.body, margin: "0 0 10px 0" },
  label: {
    fontSize: "11px",
    fontWeight: "600",
    letterSpacing: "1px",
    textTransform: "uppercase",
    color: colors.subtle,
    margin: "0 0 4px 0",
  },
  value: { fontSize: "14px", lineHeight: "20px", color: colors.text, margin: "0 0 12px 0" },
  mono: { fontFamily: fonts.mono, color: colors.text },
  divider: { borderColor: colors.border, borderTopWidth: "1px", margin: "16px 0" },
  button: {
    display: "inline-block",
    backgroundColor: colors.gold,
    color: "#09090B",
    fontSize: "13px",
    fontWeight: "700",
    padding: "14px 28px",
    borderRadius: "8px",
    textDecoration: "none",
  },
  buttonRow: { textAlign: "center", padding: "4px 0 20px 0" },
  link: { color: colors.gold, textDecoration: "underline" },
} satisfies Record<string, CSSProperties>;

export type Tone = "gold" | "success" | "warning" | "danger" | "info";

const toneRgb: Record<Tone, string> = {
  gold: "212, 175, 55",
  success: "16, 185, 129",
  warning: "245, 158, 11",
  danger: "239, 68, 68",
  info: "59, 130, 246",
};

/** The pill badge above a heading, in one of the shared tones. */
export function badgeStyle(tone: Tone = "gold"): CSSProperties {
  const rgb = toneRgb[tone];
  return {
    ...styles.badge,
    color: `rgb(${rgb})`,
    backgroundColor: `rgba(${rgb}, 0.12)`,
    border: `1px solid rgba(${rgb}, 0.3)`,
  };
}
