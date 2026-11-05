import type { ReactElement } from "react";
import { IconButton, type IconButtonProps } from "@mui/material";
import { ButtonTooltip, type ButtonTooltipPlacement } from "./button-tooltip";

interface TooltipIconButtonProps extends IconButtonProps, ButtonTooltipPlacement {
  title: string;
  /** Renders the button as a link, through the theme's link component. */
  href?: string;
  download?: string;
}

export function TooltipIconButton(props: TooltipIconButtonProps): ReactElement {
  const { title, disabled, placement, arrow, "aria-label": ariaLabel, ...rest } = props;
  return (
    <ButtonTooltip title={title} disabled={disabled} placement={placement} arrow={arrow}>
      <IconButton disabled={disabled} aria-label={ariaLabel ?? title} {...rest} />
    </ButtonTooltip>
  );
}
