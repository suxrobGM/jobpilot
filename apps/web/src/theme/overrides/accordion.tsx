import { ExpandMore } from "@mui/icons-material";
import type { Components, Theme } from "@mui/material/styles";

/** Bordered panels without MUI's gutters. `::before` is MUI's top rule, which doubles the border. */
export const accordionOverrides: Components<Theme>["MuiAccordion"] = {
  defaultProps: { disableGutters: true, elevation: 0 },
  styleOverrides: {
    root: ({ theme }) => ({
      border: `1px solid ${theme.palette.line.border}`,
      borderRadius: theme.radii.lg,
      "&::before": { display: "none" },
    }),
  },
};

export const accordionSummaryOverrides: Components<Theme>["MuiAccordionSummary"] = {
  defaultProps: { expandIcon: <ExpandMore /> },
};
