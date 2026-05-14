import type { TypographyVariantsOptions } from "@mui/material/styles";
import { textColors } from "./palette";

export const fontFamilies = {
  body: 'var(--font-geist-sans), ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  mono: 'var(--font-geist-mono), ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace',
} as const;

export const typography: TypographyVariantsOptions = {
  fontFamily: fontFamilies.body,
  h1: {
    fontFamily: fontFamilies.body,
    fontWeight: 600,
    fontSize: "1.75rem",
    lineHeight: 1.15,
    letterSpacing: "-0.02em",
  },
  h2: {
    fontFamily: fontFamilies.body,
    fontWeight: 600,
    fontSize: "1.375rem",
    lineHeight: 1.2,
    letterSpacing: "-0.015em",
  },
  h3: {
    fontFamily: fontFamilies.body,
    fontWeight: 600,
    fontSize: "1.125rem",
    letterSpacing: "-0.01em",
  },
  h4: {
    fontFamily: fontFamilies.body,
    fontWeight: 500,
    fontSize: "1rem",
    letterSpacing: "-0.005em",
  },
  h5: {
    fontFamily: fontFamilies.body,
    fontWeight: 500,
    fontSize: "0.875rem",
  },
  h6: {
    fontFamily: fontFamilies.body,
    fontWeight: 500,
    fontSize: "0.8125rem",
  },
  body1: { fontFamily: fontFamilies.body, fontSize: "0.8125rem", lineHeight: 1.55 },
  body2: { fontFamily: fontFamilies.body, fontSize: "0.75rem", lineHeight: 1.5 },
  button: {
    fontFamily: fontFamilies.body,
    textTransform: "none",
    fontWeight: 500,
    fontSize: "0.8125rem",
    letterSpacing: "-0.005em",
  },
  caption: {
    fontFamily: fontFamilies.mono,
    fontSize: "0.6875rem",
    letterSpacing: "0",
  },
  overline: {
    fontFamily: fontFamilies.mono,
    fontSize: "0.625rem",
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    lineHeight: 1,
    fontWeight: 500,
  },
  overlineMuted: {
    fontFamily: fontFamilies.mono,
    fontSize: "0.625rem",
    letterSpacing: "0.14em",
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
};
