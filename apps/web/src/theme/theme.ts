import { createTheme } from "@mui/material/styles";
import { componentOverrides } from "./overrides";
import { accent, feedback, line, stages, surfaces, textColors } from "./palette";
import { gradients, iconSizes, motion, radii, shadows } from "./tokens";
import { typography } from "./typography";

export const theme = createTheme({
  cssVariables: true,
  palette: {
    mode: "dark",
    primary: { main: accent.primary, contrastText: "#07090F" },
    secondary: { main: accent.secondary, contrastText: "#07090F" },
    warning: { main: feedback.warning },
    error: { main: feedback.error },
    success: { main: feedback.success },
    info: { main: feedback.info },
    background: { default: surfaces.base, paper: surfaces.card },
    text: {
      primary: textColors.primary,
      secondary: textColors.secondary,
      disabled: textColors.disabled,
    },
    divider: line.divider,
    surfaces,
    accent,
    line,
    stages,
  },
  shape: { borderRadius: 1 },
  typography,
  gradients,
  motion,
  radii,
  shadows_custom: shadows,
  iconSizes,
  components: componentOverrides,
});
