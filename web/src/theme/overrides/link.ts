import type { Components, Theme } from "@mui/material/styles";

export const linkOverrides: Components<Theme>["MuiLink"] = {
  defaultProps: { underline: "hover" },
  styleOverrides: {
    root: ({ theme }) => ({
      color: theme.palette.accent.primary,
      fontWeight: 500,
    }),
  },
};
