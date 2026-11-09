import { alpha, type Components, type Theme } from "@mui/material/styles";
import { iconSizes } from "../tokens";

/** Here, not in globals.css, so the palette stays the one color source. */
export const cssBaselineOverrides: Components<Theme>["MuiCssBaseline"] = {
  styleOverrides: (theme) => ({
    "::selection": {
      background: alpha(theme.palette.accent.primary, 0.3),
      color: theme.palette.text.primary,
    },
    // Mice only: a styled scrollbar takes layout width; touch keeps its free overlay bar.
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
  defaultProps: { size: "small" },
  styleOverrides: {
    root: ({ theme }) => ({
      borderRadius: theme.radii.sm,
      fontWeight: 500,
      fontSize: "0.75rem",
      height: 24,
    }),
  },
  variants: [
    {
      // The same fill as the main button and the nav badges: one orange for "this one".
      props: { variant: "filled", color: "primary" },
      style: ({ theme }) => ({
        backgroundColor: theme.palette.accent.action,
        color: theme.palette.common.white,
      }),
    },
    {
      props: { variant: "tag" },
      style: ({ theme }) => ({
        height: "auto",
        fontFamily: theme.typography.monoBody.fontFamily,
        fontWeight: 400,
        fontSize: "0.7rem",
        borderRadius: theme.radii.pill,
        color: theme.palette.text.secondary,
        border: `1px solid ${theme.palette.line.border}`,
        backgroundColor: theme.palette.surfaces.elevated,
        "& .MuiChip-label": { paddingInline: 8, paddingBlock: 2, lineHeight: 1.5 },
      }),
    },
    {
      props: { variant: "tag", size: "medium" },
      style: {
        fontSize: "0.75rem",
        "& .MuiChip-label": { paddingInline: 10, paddingBlock: 4, lineHeight: 1.55 },
      },
    },
  ],
};

/** A flex column so pages space the header and cards with `gap`. */
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
  variants: Object.entries(iconSizes).map(([size, px]) => ({
    props: { fontSize: size as keyof typeof iconSizes },
    style: { fontSize: `${px / 16}rem` },
  })),
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
      props: { variant: "inset" },
      style: ({ theme }) => ({
        border: `1px solid ${theme.palette.line.divider}`,
        borderRadius: theme.radii.sm,
        backgroundColor: theme.palette.surfaces.elevated,
      }),
    },
  ],
};

export const skeletonOverrides: Components<Theme>["MuiSkeleton"] = {
  styleOverrides: {
    // `shape.borderRadius` is pinned to 1 so sx radii read as px, which leaves MUI's
    // "rounded" skeleton a 1px square. Placeholders stand in for cards, so match those.
    rounded: ({ theme }) => ({ borderRadius: theme.radii.md }),
  },
};

/** Tooltips only label their trigger, so they should never catch the pointer on the way past. */
export const tooltipOverrides: Components<Theme>["MuiTooltip"] = {
  defaultProps: { disableInteractive: true },
};

/** Real `gap`, not MUI's child margins: margins indent the second line of a wrapped row. */
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
      lead: "p",
      eyebrow: "p",
      monoBody: "p",
      monoCaption: "span",
      docsBody: "p",
      docsH1: "h1",
      docsH2: "h2",
      docsH3: "h3",
      docsH4: "h4",
    },
  },
};
