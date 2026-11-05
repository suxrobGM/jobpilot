import type { Components, Theme } from "@mui/material/styles";
import { listOption, listPaper } from "./menu";

/** The popup is an MuiAutocomplete slot, not MuiMenu, so it takes the menu styles explicitly. */
export const autocompleteOverrides: Components<Theme>["MuiAutocomplete"] = {
  styleOverrides: {
    paper: ({ theme }) => listPaper(theme),
    listbox: { paddingBlock: 4 },
    option: ({ theme }) => ({
      ...listOption(theme),
      '&[aria-selected="true"]': {
        backgroundColor: theme.tints.selected,
        "&:hover": { backgroundColor: theme.tints.selectedHover },
      },
    }),
  },
};
