import type { Components, Theme } from "@mui/material/styles";

export const tableOverrides: Components<Theme>["MuiTable"] = {
  styleOverrides: { root: { borderCollapse: "separate", borderSpacing: 0 } },
};

export const tableHeadOverrides: Components<Theme>["MuiTableHead"] = {
  styleOverrides: {
    root: ({ theme }) => ({
      backgroundColor: theme.palette.surfaces.elevated,
      "& th": {
        textTransform: "uppercase",
        fontSize: "0.7rem",
        letterSpacing: "0.06em",
        color: theme.palette.text.secondary,
      },
    }),
  },
};

export const tableBodyOverrides: Components<Theme>["MuiTableBody"] = {};

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
      fontSize: "0.875rem",
    }),
  },
};
