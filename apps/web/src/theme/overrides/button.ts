import { type Components, lighten, type Theme } from "@mui/material/styles";
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
      // The main action is a light fill; orange stays for accents, where it reads as the brand.
      props: { variant: "contained", color: "primary" },
      style: ({ theme }) => ({
        backgroundColor: theme.palette.text.primary,
        color: theme.palette.surfaces.base,
        "&:hover": { backgroundColor: lighten(theme.palette.text.primary, 0.6) },
      }),
    },
  ],
};
