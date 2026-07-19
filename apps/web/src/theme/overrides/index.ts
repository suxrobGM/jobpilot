import type { Components, Theme } from "@mui/material/styles";
import { autocompleteOverrides } from "./autocomplete";
import { buttonOverrides } from "./button";
import {
  cardActionsOverrides,
  cardContentOverrides,
  cardHeaderOverrides,
  cardOverrides,
} from "./card";
import { dataGridOverrides } from "./data-grid";
import {
  backdropOverrides,
  dialogActionsOverrides,
  dialogContentOverrides,
  dialogOverrides,
  dialogTitleOverrides,
} from "./dialog";
import {
  formHelperTextOverrides,
  outlinedInputOverrides,
  selectOverrides,
  textFieldOverrides,
} from "./input";
import { buttonBaseOverrides, linkOverrides } from "./link";
import { menuItemOverrides, menuOverrides } from "./menu";
import {
  chipOverrides,
  containerOverrides,
  cssBaselineOverrides,
  paperOverrides,
  stackOverrides,
  svgIconOverrides,
  typographyOverrides,
} from "./misc";
import {
  tableBodyOverrides,
  tableCellOverrides,
  tableHeadOverrides,
  tableOverrides,
  tableRowOverrides,
} from "./table";
import { tabOverrides, tabsOverrides } from "./tabs";
import { toggleButtonOverrides } from "./toggle-button";

export const componentOverrides: Components<Theme> = {
  MuiAutocomplete: autocompleteOverrides,
  MuiBackdrop: backdropOverrides,
  MuiButton: buttonOverrides,
  MuiButtonBase: buttonBaseOverrides,
  MuiCard: cardOverrides,
  MuiCardActions: cardActionsOverrides,
  MuiCardContent: cardContentOverrides,
  MuiCardHeader: cardHeaderOverrides,
  MuiChip: chipOverrides,
  MuiContainer: containerOverrides,
  MuiCssBaseline: cssBaselineOverrides,
  MuiDataGrid: dataGridOverrides,
  MuiDialog: dialogOverrides,
  MuiDialogActions: dialogActionsOverrides,
  MuiDialogContent: dialogContentOverrides,
  MuiDialogTitle: dialogTitleOverrides,
  MuiFormHelperText: formHelperTextOverrides,
  MuiLink: linkOverrides,
  MuiMenu: menuOverrides,
  MuiMenuItem: menuItemOverrides,
  MuiOutlinedInput: outlinedInputOverrides,
  MuiPaper: paperOverrides,
  MuiSelect: selectOverrides,
  MuiStack: stackOverrides,
  MuiSvgIcon: svgIconOverrides,
  MuiTab: tabOverrides,
  MuiTable: tableOverrides,
  MuiTableBody: tableBodyOverrides,
  MuiTableCell: tableCellOverrides,
  MuiTableHead: tableHeadOverrides,
  MuiTableRow: tableRowOverrides,
  MuiTabs: tabsOverrides,
  MuiTextField: textFieldOverrides,
  MuiToggleButton: toggleButtonOverrides,
  MuiTypography: typographyOverrides,
};
