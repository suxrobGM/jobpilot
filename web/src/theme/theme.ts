import { createTheme } from "@mui/material/styles";
import { componentOverrides } from "./overrides";
import { accent, feedback, line, surfaces, textColors } from "./palette";
import { gradients, iconSizes, motion, radii, shadows } from "./tokens";
import { typography } from "./typography";

export const theme = createTheme({
  cssVariables: true,
  palette: {
    mode: "light",
    primary: { main: accent.primary, contrastText: "#FFFFFF" },
    secondary: { main: accent.dark, contrastText: "#FFFFFF" },
    warning: { main: feedback.warning },
    error: { main: feedback.error },
    success: { main: feedback.success },
    info: { main: feedback.info },
    background: { default: surfaces.base, paper: surfaces.card },
    text: { primary: textColors.primary, secondary: textColors.secondary, disabled: textColors.disabled },
    divider: line.divider,
    surfaces,
    accent,
    line,
  },
  shape: { borderRadius: radii.md },
  typography,
  gradients,
  motion,
  radii,
  shadows_custom: shadows,
  iconSizes,
  components: componentOverrides,
});
