import type { Components, Theme } from "@mui/material/styles";

export const dialogOverrides: Components<Theme>["MuiDialog"] = {
  styleOverrides: {
    paper: ({ theme }) => ({
      borderRadius: theme.radii.lg,
      boxShadow: theme.shadows_custom.lg,
      backgroundColor: theme.palette.surfaces.card,
    }),
  },
};

export const dialogTitleOverrides: Components<Theme>["MuiDialogTitle"] = {
  styleOverrides: { root: { fontSize: "1.125rem", fontWeight: 600, paddingBlock: 16 } },
};

export const dialogContentOverrides: Components<Theme>["MuiDialogContent"] = {
  styleOverrides: { root: { paddingBlock: 8 } },
};

export const dialogActionsOverrides: Components<Theme>["MuiDialogActions"] = {
  styleOverrides: { root: { padding: 20, gap: 8 } },
};

export const backdropOverrides: Components<Theme>["MuiBackdrop"] = {
  styleOverrides: {
    root: { backgroundColor: "rgba(15,23,42,0.4)", backdropFilter: "blur(2px)" },
  },
};
