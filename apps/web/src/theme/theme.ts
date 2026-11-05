import { createTheme, responsiveFontSizes } from "@mui/material/styles";
import { componentOverrides } from "./overrides";
import { accent, feedback, line, onAccent, stages, surfaces, textColors } from "./palette";
import { controlHeights, iconSizes, motion, radii, shadows, tints } from "./tokens";
import { typography } from "./typography";

const baseTheme = createTheme({
  cssVariables: true,
  palette: {
    mode: "dark",
    primary: { main: accent.primary, contrastText: onAccent.primary },
    secondary: { main: accent.secondary, contrastText: onAccent.secondary },
    warning: { main: feedback.warning },
    error: { main: feedback.error },
    success: { main: feedback.success },
    info: { main: feedback.info },
    background: { default: surfaces.base, paper: surfaces.card },
    text: {
      primary: textColors.primary,
      secondary: textColors.secondary,
      disabled: textColors.disabled,
      prose: textColors.prose,
    },
    divider: line.divider,
    surfaces,
    accent,
    line,
    stages,
  },
  // Keep the sx multiplier at 1 so a `radii` token in sx means that many px, exactly as in
  // styleOverrides. Component overrides pin the real radii (card md, dialog lg) explicitly.
  shape: { borderRadius: 1 },
  typography,
  motion,
  radii,
  shadows_custom: shadows,
  tints,
  iconSizes,
  controlHeights,
  components: componentOverrides,
});

// Scale headings (h1-h4) down on smaller viewports so page/marketing titles fit phones.
export const theme = responsiveFontSizes(baseTheme, { variants: ["h1", "h2", "h3", "h4"] });
