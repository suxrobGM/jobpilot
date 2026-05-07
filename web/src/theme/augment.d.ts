import type { CSSProperties } from "react";
import type { accent, line, surfaces } from "./palette";
import type { gradients, iconSizes, motion, radii, shadows } from "./tokens";

declare module "@mui/material/styles" {
  interface Palette {
    surfaces: typeof surfaces;
    accent: typeof accent;
    line: typeof line;
  }
  interface PaletteOptions {
    surfaces?: typeof surfaces;
    accent?: typeof accent;
    line?: typeof line;
  }

  interface Theme {
    gradients: typeof gradients;
    motion: typeof motion;
    radii: typeof radii;
    shadows_custom: typeof shadows;
    iconSizes: typeof iconSizes;
  }
  interface ThemeOptions {
    gradients?: typeof gradients;
    motion?: typeof motion;
    radii?: typeof radii;
    shadows_custom?: typeof shadows;
    iconSizes?: typeof iconSizes;
  }

  interface TypographyVariants {
    body1Muted: CSSProperties;
    body2Muted: CSSProperties;
    captionMuted: CSSProperties;
    overline: CSSProperties;
    overlineMuted: CSSProperties;
  }
  interface TypographyVariantsOptions {
    body1Muted?: CSSProperties;
    body2Muted?: CSSProperties;
    captionMuted?: CSSProperties;
    overline?: CSSProperties;
    overlineMuted?: CSSProperties;
  }
}

declare module "@mui/material/Typography" {
  interface TypographyPropsVariantOverrides {
    body1Muted: true;
    body2Muted: true;
    captionMuted: true;
    overline: true;
    overlineMuted: true;
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

export {};
