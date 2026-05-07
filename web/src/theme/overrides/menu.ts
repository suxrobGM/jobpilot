import type { Components, Theme } from "@mui/material/styles";

export const menuOverrides: Components<Theme>["MuiMenu"] = {
  styleOverrides: {
    paper: ({ theme }) => ({
      borderRadius: theme.radii.md,
      border: `1px solid ${theme.palette.line.divider}`,
      boxShadow: theme.shadows_custom.md,
    }),
    list: { paddingBlock: 4 },
  },
};

export const menuItemOverrides: Components<Theme>["MuiMenuItem"] = {
  styleOverrides: {
    root: ({ theme }) => ({
      fontSize: "0.875rem",
      borderRadius: theme.radii.xs,
      marginInline: 4,
      paddingBlock: 6,
      "&:hover": { backgroundColor: theme.palette.surfaces.hover },
    }),
  },
};
