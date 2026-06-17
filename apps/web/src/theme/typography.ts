import type { TypographyVariantsOptions } from "@mui/material/styles";
import { textColors } from "./palette";

export const fontFamilies = {
  body: 'var(--font-geist-sans), ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
} as const;

export const typography: TypographyVariantsOptions = {
  fontFamily: fontFamilies.body,
  h1: {
    fontFamily: fontFamilies.body,
    fontWeight: 700,
    fontSize: "2.25rem",
    lineHeight: 1.05,
    letterSpacing: "-0.03em",
  },
  h2: {
    fontFamily: fontFamilies.body,
    fontWeight: 700,
    fontSize: "1.75rem",
    lineHeight: 1.15,
    letterSpacing: "-0.025em",
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
    fontFamily: fontFamilies.body,
    fontSize: "0.6875rem",
    letterSpacing: "0",
  },
  overline: {
    fontFamily: fontFamilies.body,
    fontSize: "0.6875rem",
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    lineHeight: 1,
    fontWeight: 600,
  },
  overlineMuted: {
    fontFamily: fontFamilies.body,
    fontSize: "0.6875rem",
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    lineHeight: 1,
    fontWeight: 600,
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
    fontFamily: fontFamilies.body,
    fontSize: "0.6875rem",
    letterSpacing: "0",
    color: textColors.secondary,
  },
  statValue: {
    fontFamily: fontFamilies.body,
    fontWeight: 700,
    fontSize: "1.5rem",
    lineHeight: 1.1,
    letterSpacing: "-0.02em",
    fontVariantNumeric: "tabular-nums",
  },
  statLabel: {
    fontFamily: fontFamilies.body,
    fontSize: "0.625rem",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    lineHeight: 1,
    fontWeight: 600,
    color: textColors.secondary,
  },
};
