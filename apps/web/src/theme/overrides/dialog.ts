import { dialogTitleClasses, drawerClasses } from "@mui/material";
import { alpha, type Components, type Theme } from "@mui/material/styles";

export const dialogOverrides: Components<Theme>["MuiDialog"] = {
  styleOverrides: {
    paper: ({ theme }) => ({
      borderRadius: theme.radii.lg,
      boxShadow: theme.shadows_custom.lg,
      backgroundColor: theme.palette.surfaces.card,
      // Wide content scrolls in DialogContent; a sideways paper scroll clipped the title.
      overflowX: "hidden",
    }),
  },
};

/** Bottom sheets (the More sheet, the phone filters) round only the edge that faces the page. */
export const drawerOverrides: Components<Theme>["MuiDrawer"] = {
  styleOverrides: {
    anchorBottom: ({ theme }) => ({
      [`& .${drawerClasses.paper}`]: {
        borderTopLeftRadius: theme.radii.lg,
        borderTopRightRadius: theme.radii.lg,
      },
    }),
  },
};

export const dialogTitleOverrides: Components<Theme>["MuiDialogTitle"] = {
  styleOverrides: { root: { fontSize: "1.125rem", fontWeight: 600, paddingBlock: 16 } },
};

export const dialogContentOverrides: Components<Theme>["MuiDialogContent"] = {
  styleOverrides: {
    root: {
      paddingBlock: 8,
      // MUI zeroes the top padding after a title; the content scrolls, so that clipped the
      // floating labels of the first row of fields.
      [`.${dialogTitleClasses.root} + &`]: { paddingTop: 12 },
    },
  },
};

export const dialogActionsOverrides: Components<Theme>["MuiDialogActions"] = {
  styleOverrides: { root: { padding: 20, gap: 8 } },
};

export const backdropOverrides: Components<Theme>["MuiBackdrop"] = {
  styleOverrides: {
    root: ({ theme }) => ({
      backgroundColor: alpha(theme.palette.surfaces.base, 0.6),
      backdropFilter: "blur(3px)",
    }),
  },
};
