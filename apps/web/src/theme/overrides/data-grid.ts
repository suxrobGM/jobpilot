import type { Components, Theme } from "@mui/material/styles";
import type {} from "@mui/x-data-grid/themeAugmentation";

export const dataGridOverrides: Components<Theme>["MuiDataGrid"] = {
  defaultProps: {
    autoHeight: true,
    disableRowSelectionOnClick: true,
    pageSizeOptions: [10, 25, 50, 100],
    initialState: { pagination: { paginationModel: { pageSize: 25 } } },
  },
  styleOverrides: {
    root: ({ theme }) => ({
      width: "100%",
      border: `1px solid ${theme.palette.line.divider}`,
      borderRadius: theme.radii.md,
      backgroundColor: theme.palette.surfaces.card,
      "& .MuiDataGrid-columnHeaders": {
        backgroundColor: theme.palette.surfaces.elevated,
        fontSize: "0.7rem",
        letterSpacing: "0.06em",
        textTransform: "uppercase",
      },
      "& .MuiDataGrid-cell": { fontSize: "0.875rem" },
      "& .MuiDataGrid-row": { cursor: "pointer" },
    }),
  },
};
