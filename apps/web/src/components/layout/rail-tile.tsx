import type { ReactElement } from "react";
import { Typography } from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";

/** One rail entry: icon over a short label, accent-tinted icon while active. Spacing is in `sx` units. */
export function railTile(active: boolean): SxProps<Theme> {
  return (theme) => ({
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 0.5,
    width: "100%",
    paddingBlock: 1,
    paddingInline: 0.25,
    borderRadius: theme.radii.lg,
    color: active ? theme.palette.text.primary : theme.palette.text.secondary,
    backgroundColor: active ? theme.tints.selected : "transparent",
    textDecoration: "none",
    "& .MuiSvgIcon-root": { color: active ? theme.palette.accent.primary : undefined },
    transition: theme.motion.fast,
    "&:hover": {
      color: theme.palette.text.primary,
      backgroundColor: active ? theme.tints.selectedHover : theme.palette.surfaces.card,
    },
    "&:focus-visible, &.Mui-focusVisible": {
      outline: "none",
      boxShadow: theme.shadows_custom.focus,
    },
  });
}

interface RailLabelProps {
  children: string;
}

/** Wraps at spaces rather than truncating: "Job boards" must stay readable. */
export function RailLabel(props: RailLabelProps): ReactElement {
  return (
    <Typography variant="caption" sx={{ textAlign: "center", lineHeight: 1.2 }}>
      {props.children}
    </Typography>
  );
}
