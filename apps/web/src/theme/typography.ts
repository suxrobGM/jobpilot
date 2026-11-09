import type { TypographyVariantsOptions } from "@mui/material/styles";
import { textColors } from "./palette";

export const fontFamilies = {
  body: 'var(--font-archivo), ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  display: "var(--font-archivo), ui-sans-serif, system-ui, sans-serif",
  mono: "var(--font-jetbrains-mono), ui-monospace, SFMono-Regular, Menlo, monospace",
} as const;

const displayStretch = "125%";

/** `docsH4` reuses this size so an h4 sits flush with the prose around it. */
const docsBody = {
  fontFamily: fontFamilies.body,
  fontSize: "0.9375rem",
  lineHeight: 1.7,
  color: textColors.prose,
} as const;

/** No expanded display width: at every /docs section break it shouts. */
const docsHeading = {
  fontFamily: fontFamilies.body,
  fontWeight: 600,
} as const;

// The Muted and Strong variants are these plus one property, so the scale has one source.
const body1 = { fontFamily: fontFamilies.body, fontSize: "0.9375rem", lineHeight: 1.55 } as const;
const body2 = { fontFamily: fontFamilies.body, fontSize: "0.875rem", lineHeight: 1.5 } as const;
const caption = {
  fontFamily: fontFamilies.body,
  fontSize: "0.75rem",
  letterSpacing: "0",
} as const;
const overline = {
  fontFamily: fontFamilies.body,
  fontSize: "0.6875rem",
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  lineHeight: 1,
  fontWeight: 600,
} as const;
const muted = { color: textColors.secondary } as const;
const strong = { fontWeight: 600 } as const;

export const typography: TypographyVariantsOptions = {
  fontFamily: fontFamilies.body,
  // h1/h2 scale with clamp(), so theme.ts leaves them out of responsiveFontSizes.
  h1: {
    fontFamily: fontFamilies.display,
    fontStretch: displayStretch,
    fontWeight: 700,
    fontSize: "clamp(2rem, 1.4rem + 2.4vw, 2.9rem)",
    lineHeight: 1.1,
    letterSpacing: "-0.025em",
  },
  h2: {
    fontFamily: fontFamilies.display,
    fontStretch: displayStretch,
    fontWeight: 700,
    fontSize: "clamp(1.75rem, 1.3rem + 2vw, 2.5rem)",
    lineHeight: 1.15,
    letterSpacing: "-0.02em",
  },
  h3: {
    fontFamily: fontFamilies.display,
    fontStretch: displayStretch,
    fontWeight: 600,
    fontSize: "1.25rem",
    lineHeight: 1.25,
    letterSpacing: "-0.01em",
  },
  h4: {
    fontFamily: fontFamilies.display,
    fontStretch: displayStretch,
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
  body1,
  body2,
  button: {
    fontFamily: fontFamilies.body,
    textTransform: "none",
    fontWeight: 500,
    fontSize: "0.875rem",
    letterSpacing: 0,
  },
  caption,
  overline,
  overlineMuted: { ...overline, ...muted },
  body1Muted: { ...body1, ...muted },
  body2Muted: { ...body2, ...muted },
  captionMuted: { ...caption, ...muted },
  statValue: {
    fontFamily: fontFamilies.mono,
    fontWeight: 600,
    fontSize: "1.5rem",
    lineHeight: 1.1,
    letterSpacing: "-0.02em",
    fontVariantNumeric: "tabular-nums",
  },
  body1Strong: { ...body1, ...strong },
  body2Strong: { ...body2, ...strong },
  lead: {
    fontFamily: fontFamilies.body,
    fontSize: "clamp(0.875rem, 0.8rem + 0.3vw, 1rem)",
    lineHeight: 1.65,
    color: textColors.secondary,
  },
  /** No color; callers pick it. */
  eyebrow: {
    fontFamily: fontFamilies.mono,
    fontSize: "0.75rem",
    lineHeight: 1.4,
    letterSpacing: "0.18em",
    textTransform: "uppercase",
  },
  monoBody: {
    fontFamily: fontFamilies.mono,
    fontSize: "0.8125rem",
    lineHeight: 1.6,
  },
  monoCaption: {
    fontFamily: fontFamilies.mono,
    fontSize: "0.6875rem",
    lineHeight: 1.5,
    color: textColors.secondary,
  },
  docsBody,
  docsH1: {
    ...docsHeading,
    fontWeight: 700,
    fontSize: "1.625rem",
    lineHeight: 1.25,
    letterSpacing: "-0.015em",
  },
  docsH2: { ...docsHeading, fontSize: "1.1875rem", lineHeight: 1.35, letterSpacing: "-0.01em" },
  docsH3: { ...docsHeading, fontSize: "1rem", lineHeight: 1.4 },
  docsH4: { ...docsHeading, fontSize: docsBody.fontSize, lineHeight: 1.5 },
};
