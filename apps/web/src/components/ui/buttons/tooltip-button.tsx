import type { ReactElement } from "react";
import { Button, type ButtonProps } from "@mui/material";
import { DisabledSafeTooltip } from "./disabled-safe-tooltip";

interface TooltipButtonProps extends ButtonProps {
  /** Usually the reason the button is disabled; an empty string shows no tooltip. */
  title: string;
}

export function TooltipButton(props: TooltipButtonProps): ReactElement {
  const { title, disabled, ...rest } = props;
  return (
    <DisabledSafeTooltip title={title} disabled={disabled}>
      <Button disabled={disabled} {...rest} />
    </DisabledSafeTooltip>
  );
}
