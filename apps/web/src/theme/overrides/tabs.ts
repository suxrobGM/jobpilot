import type { Components, Theme } from "@mui/material/styles";

export const tabsOverrides: Components<Theme>["MuiTabs"] = {
  styleOverrides: {
    root: ({ theme }) => ({
      borderBottom: `1px solid ${theme.palette.line.divider}`,
      minHeight: 44,
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
      minHeight: 44,
      minWidth: 0,
      paddingInline: theme.spacing(2),
      fontSize: theme.typography.body1.fontSize,
      fontWeight: 500,
      // Text stays neutral: the accent underline marks the tab, and orange text on it read as noise.
      "&.Mui-selected": { color: theme.palette.text.primary },
    }),
  },
};
