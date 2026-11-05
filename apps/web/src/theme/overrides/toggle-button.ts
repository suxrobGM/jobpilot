import { toggleButtonGroupClasses } from "@mui/material";
import type { Components, Theme } from "@mui/material/styles";
import { controlBox, controlBoxSmall, outlinedControl } from "./control-box";

/** Shares the Button's box and outlined shell - the two sit side by side in every filter bar. */
export const toggleButtonOverrides: Components<Theme>["MuiToggleButton"] = {
  styleOverrides: {
    root: ({ theme }) => ({
      ...controlBox(theme),
      ...outlinedControl(theme),
      color: (theme.vars ?? theme).palette.text.secondary,
      textTransform: "none",
      // Tinted accent fill, not surfaces.hover, so selected != hovered-but-off. Orange text on the
      // orange tint read as brown and low-contrast, so the text stays primary.
      "&.Mui-selected": {
        color: (theme.vars ?? theme).palette.text.primary,
        borderColor: theme.palette.accent.primary,
        backgroundColor: theme.tints.selected,
        "&:hover": { backgroundColor: theme.tints.selectedHover },
      },
    }),
    sizeSmall: ({ theme }) => controlBoxSmall(theme),
  },
};

const { grouped, middleButton, lastButton, selected } = toggleButtonGroupClasses;

/**
 * MUI hides each later button's left border so neighbours share one line. That drops a selected
 * button's left edge, and merges two selected neighbours into one block.
 */
export const toggleButtonGroupOverrides: Components<Theme>["MuiToggleButtonGroup"] = {
  styleOverrides: {
    root: ({ theme }) => ({
      [`& .${middleButton}.${selected}, & .${lastButton}.${selected}`]: {
        borderLeftColor: theme.palette.accent.primary,
        zIndex: 1,
      },
      [`& .${grouped}.${selected} + .${grouped}.${selected}`]: {
        borderLeft: `1px solid ${theme.palette.accent.primary}`,
        marginLeft: -1,
      },
    }),
  },
};
