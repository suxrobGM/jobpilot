import type { TypographyVariantsOptions } from "@mui/material/styles";
import { textColors } from "./palette";

export const fontFamilies = {
  body: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  mono: "ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace",
} as const;

export const typography: TypographyVariantsOptions = {
  fontFamily: fontFamilies.body,
  h1: { fontFamily: fontFamilies.body, fontWeight: 700, fontSize: "2.25rem", lineHeight: 1.15, letterSpacing: "-0.02em" },
  h2: { fontFamily: fontFamilies.body, fontWeight: 700, fontSize: "1.75rem", lineHeight: 1.2, letterSpacing: "-0.015em" },
  h3: { fontFamily: fontFamilies.body, fontWeight: 600, fontSize: "1.375rem", letterSpacing: "-0.01em" },
  h4: { fontFamily: fontFamilies.body, fontWeight: 600, fontSize: "1.125rem" },
  h5: { fontFamily: fontFamilies.body, fontWeight: 600, fontSize: "1rem" },
  h6: { fontFamily: fontFamilies.body, fontWeight: 600, fontSize: "0.9375rem" },
  body1: { fontFamily: fontFamilies.body, fontSize: "0.9375rem", lineHeight: 1.6 },
  body2: { fontFamily: fontFamilies.body, fontSize: "0.875rem", lineHeight: 1.55 },
  button: { fontFamily: fontFamilies.body, textTransform: "none", fontWeight: 500, fontSize: "0.875rem" },
  caption: { fontFamily: fontFamilies.mono, fontSize: "0.72rem", letterSpacing: "0.04em" },
  overline: {
    fontFamily: fontFamilies.mono,
    fontSize: "0.7rem",
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    lineHeight: 1,
    fontWeight: 500,
  },
  overlineMuted: {
    fontFamily: fontFamilies.mono,
    fontSize: "0.7rem",
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    lineHeight: 1,
    fontWeight: 500,
    color: textColors.secondary,
  },
  body1Muted: { fontFamily: fontFamilies.body, fontSize: "0.9375rem", lineHeight: 1.6, color: textColors.secondary },
  body2Muted: { fontFamily: fontFamilies.body, fontSize: "0.875rem", lineHeight: 1.55, color: textColors.secondary },
  captionMuted: { fontFamily: fontFamilies.mono, fontSize: "0.72rem", letterSpacing: "0.04em", color: textColors.secondary },
};
