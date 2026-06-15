import type { Components, Theme } from "@mui/material/styles";

/**
 * Page containers are vertical stacks that rely on `gap` for spacing between the
 * header and content cards. MUI's Container is a block element by default, so
 * `gap` is inert — make it a flex column so `sx={{ gap }}` actually applies.
 */
export const containerOverrides: Components<Theme>["MuiContainer"] = {
  styleOverrides: {
    root: { display: "flex", flexDirection: "column" },
  },
};
