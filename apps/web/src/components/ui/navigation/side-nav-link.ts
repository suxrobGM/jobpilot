import type { CSSObject, Theme } from "@mui/material/styles";

/** The selected state is a neutral lift: orange over the dark card reads brown. */
export function sideNavLink(theme: Theme, active: boolean): CSSObject {
  return {
    borderRadius: theme.radii.sm,
    color: active ? theme.palette.text.primary : theme.palette.text.secondary,
    backgroundColor: active ? theme.palette.surfaces.elevated : "transparent",
    textDecoration: "none",
    transition: theme.motion.fast,
    "&:hover": { color: theme.palette.text.primary },
    "&:focus-visible": { outline: "none", boxShadow: theme.shadows_custom.focus },
  };
}
