import type { CSSObject, Theme } from "@mui/material/styles";

/** Height from the token, not padding: a button must line up with its input, and padding drifts. */
export function controlBox(theme: Theme): CSSObject {
  return {
    borderRadius: theme.radii.sm,
    paddingInline: 16,
    paddingBlock: 0,
    minHeight: theme.controlHeights.md,
    fontWeight: 500,
    letterSpacing: 0,
    whiteSpace: "nowrap",
    transition: theme.motion.standard,
    "&:focus-visible": { boxShadow: theme.shadows_custom.focus },
  };
}

export function controlBoxSmall(theme: Theme): CSSObject {
  return { paddingInline: 12, minHeight: theme.controlHeights.sm };
}

/** The outlined shell: a neutral border that warms to the accent on hover. */
export function outlinedControl(theme: Theme): CSSObject {
  return {
    borderColor: theme.palette.line.borderHi,
    "&:hover": {
      backgroundColor: theme.palette.surfaces.hover,
      borderColor: theme.palette.accent.primary,
    },
  };
}
