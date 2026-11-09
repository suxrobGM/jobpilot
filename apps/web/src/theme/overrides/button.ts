import { type Components, darken, type Theme } from "@mui/material/styles";
import { controlBox, controlBoxSmall, outlinedControl } from "./control-box";

export const buttonOverrides: Components<Theme>["MuiButton"] = {
  defaultProps: { disableElevation: true },
  styleOverrides: {
    root: ({ theme }) => ({ position: "relative", ...controlBox(theme) }),
    sizeSmall: ({ theme }) => controlBoxSmall(theme),
    // Flat: no lift or glow.
    contained: {
      fontWeight: 600,
      boxShadow: "none",
      "&:hover": { boxShadow: "none" },
    },
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
  variants: [
    {
      // Darkens on hover: lightening would drop white text below a readable contrast.
      props: { variant: "contained", color: "primary" },
      style: ({ theme }) => ({
        backgroundColor: theme.palette.accent.action,
        color: theme.palette.common.white,
        "&:hover": { backgroundColor: darken(theme.palette.accent.action, 0.12) },
      }),
    },
  ],
};
