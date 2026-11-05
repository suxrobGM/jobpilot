import type { ReactElement } from "react";
import { Button, type ButtonProps } from "@mui/material";
import { ButtonTooltip } from "./button-tooltip";

interface TooltipButtonProps extends ButtonProps {
  /** Usually the reason the button is disabled; an empty string shows no tooltip. */
  title: string;
}

export function TooltipButton(props: TooltipButtonProps): ReactElement {
  const { title, disabled, ...rest } = props;
  return (
    <ButtonTooltip title={title} disabled={disabled}>
      <Button disabled={disabled} {...rest} />
    </ButtonTooltip>
  );
}
