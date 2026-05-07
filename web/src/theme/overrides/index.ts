import type { Components, Theme } from "@mui/material/styles";
import { buttonOverrides } from "./button";
import { cardActionsOverrides, cardContentOverrides, cardHeaderOverrides, cardOverrides } from "./card";
import { chipOverrides } from "./chip";
import { backdropOverrides, dialogActionsOverrides, dialogContentOverrides, dialogOverrides, dialogTitleOverrides } from "./dialog";
import { formHelperTextOverrides, inputLabelOverrides, outlinedInputOverrides, selectOverrides, textFieldOverrides } from "./input";
import { linkOverrides } from "./link";
import { menuItemOverrides, menuOverrides } from "./menu";
import { paperOverrides } from "./paper";
import { tableBodyOverrides, tableCellOverrides, tableHeadOverrides, tableOverrides, tableRowOverrides } from "./table";
import { tabOverrides, tabsOverrides } from "./tabs";
import { typographyOverrides } from "./typography";

export const componentOverrides: Components<Theme> = {
  MuiBackdrop: backdropOverrides,
  MuiButton: buttonOverrides,
  MuiCard: cardOverrides,
  MuiCardActions: cardActionsOverrides,
  MuiCardContent: cardContentOverrides,
  MuiCardHeader: cardHeaderOverrides,
  MuiChip: chipOverrides,
  MuiDialog: dialogOverrides,
  MuiDialogActions: dialogActionsOverrides,
  MuiDialogContent: dialogContentOverrides,
  MuiDialogTitle: dialogTitleOverrides,
  MuiFormHelperText: formHelperTextOverrides,
  MuiInputLabel: inputLabelOverrides,
  MuiLink: linkOverrides,
  MuiMenu: menuOverrides,
  MuiMenuItem: menuItemOverrides,
  MuiOutlinedInput: outlinedInputOverrides,
  MuiPaper: paperOverrides,
  MuiSelect: selectOverrides,
  MuiTab: tabOverrides,
  MuiTable: tableOverrides,
  MuiTableBody: tableBodyOverrides,
  MuiTableCell: tableCellOverrides,
  MuiTableHead: tableHeadOverrides,
  MuiTableRow: tableRowOverrides,
  MuiTabs: tabsOverrides,
  MuiTextField: textFieldOverrides,
  MuiTypography: typographyOverrides,
};
