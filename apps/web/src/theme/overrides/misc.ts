import type { Components, Theme } from "@mui/material/styles";

export const chipOverrides: Components<Theme>["MuiChip"] = {
  styleOverrides: {
    root: ({ theme }) => ({
      borderRadius: theme.radii.sm,
      fontWeight: 500,
      fontSize: "0.75rem",
      height: 24,
    }),
  },
};

/**
 * Page containers are vertical stacks that rely on `gap` for spacing between the
 * header and content cards.
 */
export const containerOverrides: Components<Theme>["MuiContainer"] = {
  styleOverrides: {
    root: ({ theme }) => ({
      display: "flex",
      flexDirection: "column",
      // Tighter than MUI's 16px: the gutter stacks with the padding of the cards nested inside.
      [theme.breakpoints.down("sm")]: {
        paddingLeft: theme.spacing(1.5),
        paddingRight: theme.spacing(1.5),
      },
    }),
  },
};

export const svgIconOverrides: Components<Theme>["MuiSvgIcon"] = {
  styleOverrides: {
    root: ({ ownerState }) => ({
      ...(ownerState.fontSize === "xs" && { fontSize: "0.875rem" }),
      ...(ownerState.fontSize === "sm" && { fontSize: "1rem" }),
      ...(ownerState.fontSize === "md" && { fontSize: "1.125rem" }),
      ...(ownerState.fontSize === "lg" && { fontSize: "1.25rem" }),
      ...(ownerState.fontSize === "xl" && { fontSize: "1.5rem" }),
      ...(ownerState.fontSize === "xxl" && { fontSize: "1.75rem" }),
      ...(ownerState.fontSize === "2xxl" && { fontSize: "2rem" }),
    }),
  },
};

export const paperOverrides: Components<Theme>["MuiPaper"] = {
  defaultProps: { elevation: 0 },
  styleOverrides: {
    root: ({ theme }) => ({
      backgroundImage: "none",
      backgroundColor: theme.palette.surfaces.card,
    }),
  },
};

/**
 * `spacing` as a real flex `gap`, not MUI's default `margin-left` on every child but the first.
 * Margins survive wrapping, so any `flexWrap` row indents its second line by one gap.
 */
export const stackOverrides: Components<Theme>["MuiStack"] = {
  defaultProps: { useFlexGap: true },
};

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
