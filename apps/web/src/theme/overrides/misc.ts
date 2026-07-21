import { alpha, type Components, type Theme } from "@mui/material/styles";

/**
 * Global colour rules, kept here rather than in globals.css so the palette stays
 * the one source (CssBaseline already paints body's background/text from it).
 */
export const cssBaselineOverrides: Components<Theme>["MuiCssBaseline"] = {
  styleOverrides: (theme) => ({
    "::selection": {
      background: alpha(theme.palette.accent.primary, 0.3),
      color: theme.palette.text.primary,
    },
    // Mice only: a styled scrollbar is a classic one, and it steals layout width off the right edge.
    // Touch keeps its native overlay bar, which costs nothing and leaves content centred.
    "@media (pointer: fine)": {
      "::-webkit-scrollbar": { width: 10, height: 10 },
      "::-webkit-scrollbar-track": { background: "transparent" },
      "::-webkit-scrollbar-thumb": {
        background: theme.palette.line.border,
        borderRadius: 6,
        border: "2px solid transparent",
        backgroundClip: "padding-box",
      },
      "::-webkit-scrollbar-thumb:hover": {
        background: theme.palette.line.borderHi,
        backgroundClip: "padding-box",
      },
    },
  }),
};

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
  variants: [
    {
      props: { variant: "panel" },
      style: ({ theme }) => ({
        border: `1px solid ${theme.palette.line.border}`,
        borderRadius: theme.radii.md,
      }),
    },
  ],
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
      body1Strong: "p",
      body2Strong: "p",
      displayLg: "h1",
      displayMd: "h2",
    },
  },
};
