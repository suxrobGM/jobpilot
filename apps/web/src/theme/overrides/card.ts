import type { Components, Theme } from "@mui/material/styles";

export const cardOverrides: Components<Theme>["MuiCard"] = {
  defaultProps: { elevation: 0 },
  styleOverrides: {
    root: ({ theme }) => ({
      borderRadius: theme.radii.md,
      border: `1px solid ${theme.palette.line.border}`,
      backgroundColor: theme.palette.surfaces.card,
      boxShadow: theme.shadows_custom.sm,
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
      props: { variant: "live" },
      style: ({ theme }) => ({
        cursor: "pointer",
        border: `1px solid ${theme.palette.accent.primary}66`,
        backgroundColor: `${theme.palette.accent.primary}0D`,
        boxShadow: `0 0 0 1px ${theme.palette.accent.primary}22, 0 4px 18px ${theme.palette.accent.primary}1A`,
        "&:hover": {
          borderColor: `${theme.palette.accent.primary}99`,
          backgroundColor: `${theme.palette.accent.primary}14`,
        },
      }),
    },
  ],
};

export const cardHeaderOverrides: Components<Theme>["MuiCardHeader"] = {
  styleOverrides: {
    root: { paddingInline: 20, paddingTop: 16, paddingBottom: 8 },
    title: { fontSize: "1.0625rem", fontWeight: 600, lineHeight: 1.3 },
    subheader: { fontSize: "0.8125rem", marginTop: 2 },
  },
};

export const cardContentOverrides: Components<Theme>["MuiCardContent"] = {
  styleOverrides: {
    root: { padding: 20, "&:last-child": { paddingBottom: 20 } },
  },
};

export const cardActionsOverrides: Components<Theme>["MuiCardActions"] = {
  styleOverrides: { root: { padding: 16, gap: 8 } },
};
