import type { CSSProperties } from "react";
import type { accent, line, stages, surfaces } from "./palette";
import type { controlHeights, gradients, iconSizes, motion, radii, shadows } from "./tokens";

declare module "@mui/material/styles" {
  interface Palette {
    surfaces: typeof surfaces;
    accent: typeof accent;
    line: typeof line;
    stages: typeof stages;
  }
  interface PaletteOptions {
    surfaces?: typeof surfaces;
    accent?: typeof accent;
    line?: typeof line;
    stages?: typeof stages;
  }

  interface Theme {
    gradients: typeof gradients;
    motion: typeof motion;
    radii: typeof radii;
    shadows_custom: typeof shadows;
    iconSizes: typeof iconSizes;
    controlHeights: typeof controlHeights;
  }
  interface ThemeOptions {
    gradients?: typeof gradients;
    motion?: typeof motion;
    radii?: typeof radii;
    shadows_custom?: typeof shadows;
    iconSizes?: typeof iconSizes;
    controlHeights?: typeof controlHeights;
  }

  interface TypographyVariants {
    body1Muted: CSSProperties;
    body2Muted: CSSProperties;
    captionMuted: CSSProperties;
    overline: CSSProperties;
    overlineMuted: CSSProperties;
    statValue: CSSProperties;
    statLabel: CSSProperties;
    body1Strong: CSSProperties;
    body2Strong: CSSProperties;
    displayLg: CSSProperties;
    displayMd: CSSProperties;
  }
  interface TypographyVariantsOptions {
    body1Muted?: CSSProperties;
    body2Muted?: CSSProperties;
    captionMuted?: CSSProperties;
    overline?: CSSProperties;
    overlineMuted?: CSSProperties;
    statValue?: CSSProperties;
    statLabel?: CSSProperties;
    body1Strong?: CSSProperties;
    body2Strong?: CSSProperties;
    displayLg?: CSSProperties;
    displayMd?: CSSProperties;
  }
}

declare module "@mui/material/Typography" {
  interface TypographyPropsVariantOverrides {
    body1Muted: true;
    body2Muted: true;
    captionMuted: true;
    overline: true;
    overlineMuted: true;
    statValue: true;
    statLabel: true;
    body1Strong: true;
    body2Strong: true;
    displayLg: true;
    displayMd: true;
  }
}

declare module "@mui/material/SvgIcon" {
  interface SvgIconPropsSizeOverrides {
    xs: true;
    sm: true;
    md: true;
    lg: true;
    xl: true;
    xxl: true;
    "2xxl": true;
  }
}

declare module "@mui/material/Paper" {
  interface PaperPropsVariantOverrides {
    interactive: true;
    live: true;
    /** Hover-lift + accent glow, for a whole card that is a link. */
    lift: true;
    /** Flame-accent border, for inline CTA cards. */
    accent: true;
    panel: true;
  }
}
