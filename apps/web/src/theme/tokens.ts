import { alpha } from "@mui/material/styles";
import { accent } from "./palette";

export const glows = {
  top: `radial-gradient(ellipse 80% 60% at 50% -10%, ${alpha(accent.primary, 0.09)}, transparent 60%)`,
  corner: `radial-gradient(ellipse 45% 90% at 10% -15%, ${alpha(accent.primary, 0.2)}, transparent 50%)`,
  center: `radial-gradient(ellipse 60% 60% at 50% 50%, ${alpha(accent.primary, 0.08)}, transparent 70%)`,
} as const;

export const tints = {
  selected: alpha(accent.primary, 0.16),
  selectedHover: alpha(accent.primary, 0.24),
} as const;

export const motion = {
  fast: "160ms cubic-bezier(0.3,0.7,0.2,1)",
  standard: "240ms cubic-bezier(0.2,0.8,0.2,1)",
  expressive: "320ms cubic-bezier(0.2,0.8,0.2,1)",
} as const;

export const shadows = {
  highlight: "inset 0 1px 0 rgba(255,255,255,0.04)",
  md: "0 4px 14px rgba(0,0,0,0.45), 0 0 0 0.5px rgba(255,255,255,0.04)",
  lg: "0 18px 36px -10px rgba(0,0,0,0.6), 0 0 0 0.5px rgba(255,255,255,0.05)",
  focus: `0 0 0 2px ${alpha(accent.primary, 0.5)}`,
  // `filter` values: drop-shadow follows the mark's outline where box-shadow would draw a square.
  markGlow: `drop-shadow(0 2px 8px rgba(0,0,0,0.4)) drop-shadow(0 0 12px ${alpha(accent.primary, 0.22)})`,
  markGlowHover: `drop-shadow(0 6px 18px rgba(0,0,0,0.5)) drop-shadow(0 0 20px ${alpha(accent.primary, 0.45)})`,
} as const;

/** Cards and panes `lg`, buttons and inputs `md`, chips and tags `sm`. */
export const radii = {
  xs: 2,
  sm: 4,
  md: 6,
  lg: 8,
  pill: 999,
} as const;

/**
 * Every input, button and toggle snaps to these, so filter rows line up without `sx`.
 * `md` is what MUI's `size="small"` outlined input measures at our 15px body font.
 */
export const controlHeights = {
  sm: 34,
  md: 40,
} as const;

export const iconSizes = {
  xs: 14,
  sm: 16,
  md: 18,
  lg: 20,
  xl: 24,
  xxl: 28,
  "2xxl": 32,
} as const;

export type IconSizeToken = keyof typeof iconSizes;
