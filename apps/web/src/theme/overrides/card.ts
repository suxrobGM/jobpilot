import { alpha, type Components, type Theme } from "@mui/material/styles";

export const cardOverrides: Components<Theme>["MuiCard"] = {
  defaultProps: { elevation: 0 },
  styleOverrides: {
    root: ({ theme }) => ({
      borderRadius: theme.radii.lg,
      border: `1px solid ${theme.palette.line.border}`,
      backgroundColor: theme.palette.surfaces.card,
      boxShadow: theme.shadows_custom.highlight,
      transition: theme.motion.fast,
    }),
  },
  variants: [
    {
      props: { variant: "interactive" },
      style: ({ theme }) => ({
        cursor: "pointer",
        "&:hover": {
          borderColor: theme.palette.line.borderHi,
          backgroundColor: theme.palette.surfaces.elevated,
        },
      }),
    },
    {
      props: { variant: "lift" },
      style: ({ theme }) => ({
        height: "100%",
        "&:hover": {
          transform: "translateY(-2px)",
          borderColor: alpha(theme.palette.accent.primary, 0.5),
          boxShadow: `${theme.shadows_custom.highlight}, 0 12px 32px -16px ${alpha(theme.palette.accent.primary, 0.35)}`,
        },
      }),
    },
    {
      props: { variant: "accent" },
      style: ({ theme }) => ({
        borderColor: alpha(theme.palette.accent.primary, 0.35),
      }),
    },
    {
      props: { variant: "showcase" },
      style: ({ theme }) => ({
        borderRadius: theme.radii.lg,
        boxShadow: theme.shadows_custom.lg,
        // Every caller clips to the radius - panel chrome, transcript rows, video.
        overflow: "hidden",
      }),
    },
  ],
};

// Tighter below sm: cards nest, and two levels at the desktop 20px eat a fifth of a phone's width.
export const cardHeaderOverrides: Components<Theme>["MuiCardHeader"] = {
  styleOverrides: {
    root: ({ theme }) => ({
      paddingInline: 14,
      paddingTop: 14,
      paddingBottom: 8,
      [theme.breakpoints.up("sm")]: { paddingInline: 20, paddingTop: 16 },
    }),
    title: { fontSize: "1.0625rem", fontWeight: 600, lineHeight: 1.3 },
    subheader: { fontSize: "0.8125rem", marginTop: 2 },
  },
};

export const cardContentOverrides: Components<Theme>["MuiCardContent"] = {
  styleOverrides: {
    root: ({ theme }) => ({
      padding: 14,
      "&:last-child": { paddingBottom: 14 },
      [theme.breakpoints.up("sm")]: {
        padding: 20,
        "&:last-child": { paddingBottom: 20 },
      },
    }),
  },
};

export const cardActionsOverrides: Components<Theme>["MuiCardActions"] = {
  styleOverrides: {
    root: ({ theme }) => ({
      padding: 12,
      gap: 8,
      [theme.breakpoints.up("sm")]: { padding: 16 },
    }),
  },
};
