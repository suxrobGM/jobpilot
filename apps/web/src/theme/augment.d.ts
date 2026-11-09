import type { CSSProperties } from "react";
import type { accent, line, surfaces } from "./palette";
import type { controlHeights, iconSizes, motion, radii, shadows, tints } from "./tokens";

/** Add variants here only; the three MUI interfaces below derive from it. */
interface CustomTypographyVariants {
  body1Muted: CSSProperties;
  body2Muted: CSSProperties;
  captionMuted: CSSProperties;
  overline: CSSProperties;
  overlineMuted: CSSProperties;
  statValue: CSSProperties;
  body1Strong: CSSProperties;
  body2Strong: CSSProperties;
  lead: CSSProperties;
  eyebrow: CSSProperties;
  monoBody: CSSProperties;
  monoCaption: CSSProperties;
  docsBody: CSSProperties;
  docsH1: CSSProperties;
  docsH2: CSSProperties;
  docsH3: CSSProperties;
  docsH4: CSSProperties;
}

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
    motion: typeof motion;
    radii: typeof radii;
    shadows_custom: typeof shadows;
    tints: typeof tints;
    iconSizes: typeof iconSizes;
    controlHeights: typeof controlHeights;
  }
  interface ThemeOptions {
    motion?: typeof motion;
    radii?: typeof radii;
    shadows_custom?: typeof shadows;
    tints?: typeof tints;
    iconSizes?: typeof iconSizes;
    controlHeights?: typeof controlHeights;
  }

  interface TypographyVariants extends CustomTypographyVariants {}
  interface TypographyVariantsOptions extends Partial<CustomTypographyVariants> {}

  interface TypeText {
    prose: string;
  }
}

declare module "@mui/material/Typography" {
  interface TypographyPropsVariantOverrides extends Record<keyof CustomTypographyVariants, true> {}
}

declare module "@mui/material/SvgIcon" {
  interface SvgIconPropsSizeOverrides {
    xs: true;
    sm: true;
    md: true;
    lg: true;
    xl: true;
  }
}

declare module "@mui/material/Chip" {
  interface ChipPropsVariantOverrides {
    /** A mono pill for skills and board names; `size="medium"` for the larger one. */
    tag: true;
  }
}

declare module "@mui/material/Badge" {
  interface BadgePropsVariantOverrides {
    inline: true;
  }
}

declare module "@mui/material/Paper" {
  interface PaperPropsVariantOverrides {
    /** For a whole card that is a link. */
    lift: true;
    /** For inline CTA cards. */
    accent: true;
    /** A cell inside a card. */
    inset: true;
    showcase: true;
    field: true;
  }
}
