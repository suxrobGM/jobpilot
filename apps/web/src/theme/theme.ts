import { createTheme, responsiveFontSizes } from "@mui/material/styles";
import { componentOverrides } from "./overrides";
import { accent, feedback, line, stages, surfaces, textColors } from "./palette";
import { controlHeights, gradients, iconSizes, motion, radii, shadows } from "./tokens";
import { typography } from "./typography";

const baseTheme = createTheme({
  cssVariables: true,
  palette: {
    mode: "dark",
    primary: { main: accent.primary, contrastText: "#1A0A05" },
    secondary: { main: accent.secondary, contrastText: "#0A1220" },
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
  // Global default = the sm token; component overrides pin larger radii (card md, dialog lg) explicitly.
  shape: { borderRadius: radii.sm },
  typography,
  gradients,
  motion,
  radii,
  shadows_custom: shadows,
  iconSizes,
  controlHeights,
  components: componentOverrides,
});

// Scale headings (h1-h4) down on smaller viewports so page/marketing titles fit phones.
export const theme = responsiveFontSizes(baseTheme, { variants: ["h1", "h2", "h3", "h4"] });
