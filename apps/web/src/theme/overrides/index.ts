import type { Components, Theme } from "@mui/material/styles";
import { buttonOverrides } from "./button";
import {
  cardActionsOverrides,
  cardContentOverrides,
  cardHeaderOverrides,
  cardOverrides,
} from "./card";
import { chipOverrides } from "./chip";
import { containerOverrides } from "./container";
import { dataGridOverrides } from "./data-grid";
import {
  backdropOverrides,
  dialogActionsOverrides,
  dialogContentOverrides,
  dialogOverrides,
  dialogTitleOverrides,
} from "./dialog";
import { svgIconOverrides } from "./icon";
import {
  formHelperTextOverrides,
  outlinedInputOverrides,
  selectOverrides,
  textFieldOverrides,
} from "./input";
import { linkOverrides } from "./link";
import { menuItemOverrides, menuOverrides } from "./menu";
import { paperOverrides } from "./paper";
import {
  tableBodyOverrides,
  tableCellOverrides,
  tableHeadOverrides,
  tableOverrides,
  tableRowOverrides,
} from "./table";
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
  MuiContainer: containerOverrides,
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
  MuiSvgIcon: svgIconOverrides,
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
