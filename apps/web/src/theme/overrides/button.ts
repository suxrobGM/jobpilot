import { type Components, lighten, type Theme } from "@mui/material/styles";
import { controlBox, controlBoxSmall, outlinedControl } from "./control-box";

export const buttonOverrides: Components<Theme>["MuiButton"] = {
  defaultProps: { disableElevation: true },
  styleOverrides: {
    root: ({ theme }) => ({ position: "relative", ...controlBox(theme) }),
    sizeSmall: ({ theme }) => controlBoxSmall(theme),
    // Flat: lighten on hover, no lift or glow.
    contained: ({ theme }) => ({
      backgroundColor: theme.palette.accent.primary,
      color: (theme.vars ?? theme).palette.primary.contrastText,
      fontWeight: 600,
      boxShadow: "none",
      "&:hover": {
        backgroundColor: lighten(theme.palette.accent.primary, 0.14),
        boxShadow: "none",
      },
    }),
    outlined: ({ theme }) => ({
      ...outlinedControl(theme),
      color: (theme.vars ?? theme).palette.text.primary,
    }),
    text: ({ theme }) => ({
      color: (theme.vars ?? theme).palette.text.primary,
      textUnderlineOffset: 4,
      textDecorationThickness: 1,
      "&:hover": {
        color: theme.palette.accent.primary,
        textDecoration: "underline",
        backgroundColor: "transparent",
      },
    }),
  },
};
