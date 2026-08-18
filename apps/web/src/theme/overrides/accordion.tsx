import { ExpandMore } from "@mui/icons-material";
import type { Components, Theme } from "@mui/material/styles";

/**
 * The app's accordions are bordered panels, so they borrow Paper's `panel` variant and drop MUI's
 * gutters. `::before` is MUI's top divider rule, which doubles the panel border.
 */
export const accordionOverrides: Components<Theme>["MuiAccordion"] = {
  defaultProps: { disableGutters: true, elevation: 0, variant: "panel" },
  styleOverrides: {
    root: { "&::before": { display: "none" } },
  },
};

export const accordionSummaryOverrides: Components<Theme>["MuiAccordionSummary"] = {
  defaultProps: { expandIcon: <ExpandMore /> },
};
