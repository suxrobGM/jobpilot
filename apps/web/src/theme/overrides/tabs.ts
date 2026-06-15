import type { Components, Theme } from "@mui/material/styles";

export const tabsOverrides: Components<Theme>["MuiTabs"] = {
  styleOverrides: {
    root: ({ theme }) => ({
      borderBottom: `1px solid ${theme.palette.line.divider}`,
      minHeight: 38,
    }),
    indicator: ({ theme }) => ({
      height: 2,
      backgroundColor: theme.palette.accent.primary,
    }),
  },
};

export const tabOverrides: Components<Theme>["MuiTab"] = {
  styleOverrides: {
    root: ({ theme }) => ({
      textTransform: "none",
      minHeight: 38,
      fontSize: "0.875rem",
      fontWeight: 500,
      "&.Mui-selected": { color: theme.palette.accent.primary },
    }),
  },
};
