import type { Components, CSSObject, Theme } from "@mui/material/styles";

/** One row in a floating list; MenuItem and the Autocomplete option share it. */
export function listOption(theme: Theme): CSSObject {
  return {
    fontSize: theme.typography.body1.fontSize,
    borderRadius: theme.radii.xs,
    marginInline: 4,
    paddingBlock: 6,
    "&:hover": { backgroundColor: theme.palette.surfaces.hover },
  };
}

/** The floating surface under a menu or an Autocomplete popup. */
export function listPaper(theme: Theme): CSSObject {
  return {
    borderRadius: theme.radii.md,
    border: `1px solid ${theme.palette.line.divider}`,
    boxShadow: theme.shadows_custom.md,
  };
}

export const menuOverrides: Components<Theme>["MuiMenu"] = {
  styleOverrides: {
    paper: ({ theme }) => listPaper(theme),
    list: { paddingBlock: 4 },
  },
};

export const menuItemOverrides: Components<Theme>["MuiMenuItem"] = {
  styleOverrides: {
    root: ({ theme }) => listOption(theme),
  },
};
