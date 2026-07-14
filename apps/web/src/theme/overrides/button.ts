import { alpha, type Components, type Theme } from "@mui/material/styles";
import { controlBox, controlBoxSmall, outlinedControl } from "./control-box";

export const buttonOverrides: Components<Theme>["MuiButton"] = {
  defaultProps: { disableElevation: true },
  styleOverrides: {
    root: ({ theme }) => ({ position: "relative", ...controlBox(theme) }),
    sizeSmall: ({ theme }) => controlBoxSmall(theme),
    contained: ({ theme }) => ({
      backgroundColor: theme.palette.accent.primary,
      color: (theme.vars ?? theme).palette.primary.contrastText,
      boxShadow: `inset 0 1px 0 rgba(255,255,255,0.18), 0 2px 12px -6px ${alpha(theme.palette.accent.primary, 0.45)}, 0 1px 0 rgba(0,0,0,0.25)`,
      "&:hover": {
        backgroundColor: theme.palette.accent.dark,
        transform: "translateY(-1px)",
        // afterburner: flame glow blooms on hover
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.2), 0 8px 24px -6px ${alpha(theme.palette.accent.primary, 0.6)}, 0 1px 0 rgba(0,0,0,0.3)`,
      },
      "&:active": {
        transform: "translateY(0)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08), 0 1px 0 rgba(0,0,0,0.3)",
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
