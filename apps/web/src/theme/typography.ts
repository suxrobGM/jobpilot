import type { TypographyVariantsOptions } from "@mui/material/styles";
import { textColors } from "./palette";

export const fontFamilies = {
  body: 'var(--font-geist-sans), ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  display: 'var(--font-fraunces), "Iowan Old Style", "Charter", Georgia, "Times New Roman", serif',
  mono: 'var(--font-jetbrains-mono), ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace',
} as const;

export const typography: TypographyVariantsOptions = {
  fontFamily: fontFamilies.body,
  h1: {
    fontFamily: fontFamilies.display,
    fontWeight: 400,
    fontSize: "2.25rem",
    lineHeight: 1.05,
    letterSpacing: "-0.025em",
    fontFeatureSettings: '"ss01", "ss02"',
  },
  h2: {
    fontFamily: fontFamilies.display,
    fontWeight: 400,
    fontSize: "1.75rem",
    lineHeight: 1.12,
    letterSpacing: "-0.02em",
    fontFeatureSettings: '"ss01"',
  },
  h3: {
    fontFamily: fontFamilies.body,
    fontWeight: 600,
    fontSize: "1.25rem",
    lineHeight: 1.25,
    letterSpacing: "-0.01em",
  },
  h4: {
    fontFamily: fontFamilies.body,
    fontWeight: 600,
    fontSize: "1.0625rem",
    lineHeight: 1.3,
    letterSpacing: "-0.005em",
  },
  h5: {
    fontFamily: fontFamilies.body,
    fontWeight: 500,
    fontSize: "0.9375rem",
    lineHeight: 1.35,
  },
  h6: {
    fontFamily: fontFamilies.body,
    fontWeight: 500,
    fontSize: "0.8125rem",
    lineHeight: 1.4,
  },
  body1: { fontFamily: fontFamilies.body, fontSize: "0.8125rem", lineHeight: 1.55 },
  body2: { fontFamily: fontFamilies.body, fontSize: "0.75rem", lineHeight: 1.5 },
  button: {
    fontFamily: fontFamilies.body,
    textTransform: "none",
    fontWeight: 500,
    fontSize: "0.8125rem",
    letterSpacing: 0,
  },
  caption: {
    fontFamily: fontFamilies.mono,
    fontSize: "0.6875rem",
    letterSpacing: "0",
  },
  overline: {
    fontFamily: fontFamilies.mono,
    fontSize: "0.6875rem",
    letterSpacing: "0.16em",
    textTransform: "uppercase",
    lineHeight: 1,
    fontWeight: 500,
  },
  overlineMuted: {
    fontFamily: fontFamilies.mono,
    fontSize: "0.6875rem",
    letterSpacing: "0.16em",
    textTransform: "uppercase",
    lineHeight: 1,
    fontWeight: 500,
    color: textColors.secondary,
  },
  body1Muted: {
    fontFamily: fontFamilies.body,
    fontSize: "0.8125rem",
    lineHeight: 1.55,
    color: textColors.secondary,
  },
  body2Muted: {
    fontFamily: fontFamilies.body,
    fontSize: "0.75rem",
    lineHeight: 1.5,
    color: textColors.secondary,
  },
  captionMuted: {
    fontFamily: fontFamilies.mono,
    fontSize: "0.6875rem",
    letterSpacing: "0",
    color: textColors.secondary,
  },
  statValue: {
    fontFamily: fontFamilies.display,
    fontWeight: 400,
    fontSize: "1.5rem",
    lineHeight: 1.1,
    letterSpacing: "-0.01em",
  },
  statLabel: {
    fontFamily: fontFamilies.mono,
    fontSize: "0.625rem",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    lineHeight: 1,
    fontWeight: 500,
    color: textColors.secondary,
  },
};
