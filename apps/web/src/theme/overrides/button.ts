import type { Components, Theme } from "@mui/material/styles";
import { controlBox, controlBoxSmall, outlinedControl } from "./control-box";

export const buttonOverrides: Components<Theme>["MuiButton"] = {
  defaultProps: { disableElevation: true },
  styleOverrides: {
    root: ({ theme }) => ({ position: "relative", ...controlBox(theme) }),
    sizeSmall: ({ theme }) => controlBoxSmall(theme),
    contained: ({ theme }) => ({
      backgroundColor: theme.palette.accent.primary,
      color: (theme.vars ?? theme).palette.primary.contrastText,
      boxShadow: theme.shadows_custom.button,
      "&:hover": {
        backgroundColor: theme.palette.accent.dark,
        transform: "translateY(-1px)",
        boxShadow: theme.shadows_custom.buttonHover,
      },
      "&:active": {
        transform: "translateY(0)",
        boxShadow: theme.shadows_custom.buttonActive,
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
