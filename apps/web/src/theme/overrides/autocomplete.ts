import { alpha, type Components, type Theme } from "@mui/material/styles";

/** The popup is an MuiAutocomplete slot, not MuiMenu, so it needs its own border/shadow to lift off the page. */
export const autocompleteOverrides: Components<Theme>["MuiAutocomplete"] = {
  styleOverrides: {
    paper: ({ theme }) => ({
      borderRadius: theme.radii.md,
      border: `1px solid ${theme.palette.line.divider}`,
      boxShadow: theme.shadows_custom.md,
    }),
    listbox: { paddingBlock: 4 },
    option: ({ theme }) => ({
      fontSize: "0.875rem",
      borderRadius: theme.radii.xs,
      marginInline: 4,
      paddingBlock: 6,
      "&:hover": { backgroundColor: theme.palette.surfaces.hover },
      '&[aria-selected="true"]': {
        backgroundColor: alpha(theme.palette.accent.primary, 0.16),
        "&:hover": { backgroundColor: alpha(theme.palette.accent.primary, 0.24) },
      },
    }),
  },
};
