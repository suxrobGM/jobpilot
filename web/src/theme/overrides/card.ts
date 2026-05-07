import type { Components, Theme } from "@mui/material/styles";

export const cardOverrides: Components<Theme>["MuiCard"] = {
  defaultProps: { elevation: 0 },
  styleOverrides: {
    root: ({ theme }) => ({
      borderRadius: theme.radii.md,
      border: `1px solid ${theme.palette.line.divider}`,
      backgroundColor: theme.palette.surfaces.card,
      boxShadow: theme.shadows_custom.sm,
    }),
  },
};

export const cardHeaderOverrides: Components<Theme>["MuiCardHeader"] = {
  styleOverrides: {
    root: { paddingInline: 20, paddingTop: 16, paddingBottom: 8 },
    title: { fontSize: "0.9375rem", fontWeight: 600 },
    subheader: { fontSize: "0.8125rem" },
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
