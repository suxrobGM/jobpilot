import type { Components, Theme } from "@mui/material/styles";

export const typographyOverrides: Components<Theme>["MuiTypography"] = {
  defaultProps: {
    variantMapping: {
      body1Muted: "p",
      body2Muted: "p",
      captionMuted: "span",
      overline: "span",
      overlineMuted: "span",
    },
  },
};
