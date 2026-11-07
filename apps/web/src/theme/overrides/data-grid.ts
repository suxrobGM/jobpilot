import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from "@jobpilot/contracts/pagination";
import type { Components, Theme } from "@mui/material/styles";
import type {} from "@mui/x-data-grid/themeAugmentation";
import { columnHeaderTextStyles } from "./table";

export const dataGridOverrides: Components<Theme>["MuiDataGrid"] = {
  defaultProps: {
    autoHeight: true,
    disableRowSelectionOnClick: true,
    pageSizeOptions: [...PAGE_SIZE_OPTIONS],
    initialState: { pagination: { paginationModel: { pageSize: DEFAULT_PAGE_SIZE } } },
  },
  styleOverrides: {
    root: ({ theme }) => ({
      width: "100%",
      border: `1px solid ${theme.palette.line.divider}`,
      borderRadius: theme.radii.lg,
      backgroundColor: theme.palette.surfaces.card,
      "& .MuiDataGrid-columnHeaders": {
        backgroundColor: theme.palette.surfaces.elevated,
        ...columnHeaderTextStyles(theme),
      },
      "& .MuiDataGrid-cell": { fontSize: theme.typography.body1.fontSize },
      "& .MuiDataGrid-row": { cursor: "pointer" },
    }),
  },
};
