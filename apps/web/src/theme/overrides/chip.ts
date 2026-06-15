import type { Components, Theme } from "@mui/material/styles";

export const chipOverrides: Components<Theme>["MuiChip"] = {
  styleOverrides: {
    root: ({ theme }) => ({
      borderRadius: theme.radii.sm,
      fontWeight: 500,
      fontSize: "0.75rem",
      height: 24,
    }),
  },
};
