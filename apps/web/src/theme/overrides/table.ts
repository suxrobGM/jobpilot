import type { Components, CSSObject, Theme } from "@mui/material/styles";

function columnHeaderTextStyles(theme: Theme): CSSObject {
  return {
    textTransform: "uppercase",
    fontSize: theme.typography.caption.fontSize,
    letterSpacing: "0.06em",
  };
}

export const tableOverrides: Components<Theme>["MuiTable"] = {
  defaultProps: { size: "small" },
  styleOverrides: { root: { borderCollapse: "separate", borderSpacing: 0 } },
};

export const tableHeadOverrides: Components<Theme>["MuiTableHead"] = {
  styleOverrides: {
    root: ({ theme }) => ({
      backgroundColor: theme.palette.surfaces.elevated,
      "& th": {
        ...columnHeaderTextStyles(theme),
        color: (theme.vars ?? theme).palette.text.secondary,
      },
    }),
  },
};

export const tableRowOverrides: Components<Theme>["MuiTableRow"] = {
  styleOverrides: {
    root: ({ theme }) => ({
      "&:hover": { backgroundColor: theme.palette.surfaces.hover },
    }),
  },
};

export const tableCellOverrides: Components<Theme>["MuiTableCell"] = {
  styleOverrides: {
    root: ({ theme }) => ({
      borderBottom: `1px solid ${theme.palette.line.divider}`,
      padding: "10px 14px",
      fontSize: theme.typography.body1.fontSize,
    }),
  },
};
