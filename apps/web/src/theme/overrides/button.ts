import type { Components, Theme } from "@mui/material/styles";

export const buttonOverrides: Components<Theme>["MuiButton"] = {
  defaultProps: { disableElevation: true },
  styleOverrides: {
    root: ({ theme }) => ({
      position: "relative",
      borderRadius: theme.radii.sm,
      paddingInline: 16,
      paddingBlock: 9,
      fontWeight: 500,
      letterSpacing: 0,
      transition: theme.motion.standard,
      "&:focus-visible": { boxShadow: theme.shadows_custom.focus },
    }),
    sizeSmall: { paddingInline: 12, paddingBlock: 6 },
    contained: ({ theme }) => ({
      backgroundColor: theme.palette.accent.primary,
      color: "#ECE7DC",
      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.12), 0 1px 0 rgba(0,0,0,0.25)",
      "&:hover": {
        backgroundColor: theme.palette.accent.dark,
        transform: "translateY(-1px)",
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.14), 0 6px 16px -6px rgba(217,87,58,0.5), 0 1px 0 rgba(0,0,0,0.3)",
      },
      "&:active": {
        transform: "translateY(0)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08), 0 1px 0 rgba(0,0,0,0.3)",
      },
    }),
    outlined: ({ theme }) => ({
      borderColor: theme.palette.line.borderHi,
      color: theme.palette.text.primary,
      "&:hover": {
        backgroundColor: theme.palette.surfaces.hover,
        borderColor: theme.palette.accent.primary,
      },
    }),
    text: ({ theme }) => ({
      color: theme.palette.text.primary,
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
