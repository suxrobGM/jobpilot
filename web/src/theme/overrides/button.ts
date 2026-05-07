import type { Components, Theme } from "@mui/material/styles";

export const buttonOverrides: Components<Theme>["MuiButton"] = {
  defaultProps: { disableElevation: true },
  styleOverrides: {
    root: ({ theme }) => ({
      borderRadius: theme.radii.sm,
      paddingInline: 14,
      paddingBlock: 8,
      transition: theme.motion.fast,
      fontWeight: 500,
      "&:focus-visible": { boxShadow: theme.shadows_custom.focus },
    }),
    sizeSmall: { paddingInline: 10, paddingBlock: 5 },
    contained: ({ theme }) => ({
      "&:hover": { backgroundColor: theme.palette.accent.dark },
    }),
  },
};
