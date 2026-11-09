import { createTheme, responsiveFontSizes } from "@mui/material/styles";
import { componentOverrides } from "./overrides";
import { accent, feedback, line, surfaces, textColors, textOnAccent } from "./palette";
import { controlHeights, iconSizes, motion, radii, shadows, tints } from "./tokens";
import { typography } from "./typography";

const baseTheme = createTheme({
  cssVariables: true,
  palette: {
    mode: "dark",
    primary: { main: accent.primary, contrastText: textOnAccent.primary },
    secondary: { main: accent.secondary, contrastText: textOnAccent.secondary },
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

// h1/h2 are fluid clamp() sizes already; this steps the fixed h3/h4 down on phones.
export const theme = responsiveFontSizes(baseTheme, { variants: ["h3", "h4"] });
