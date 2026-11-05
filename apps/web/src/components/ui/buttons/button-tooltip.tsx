import type { ReactElement } from "react";
import { Box, Tooltip, type TooltipProps } from "@mui/material";

export type ButtonTooltipPlacement = Pick<TooltipProps, "placement" | "arrow">;

interface ButtonTooltipProps extends ButtonTooltipPlacement {
  title: string;
  disabled: boolean | undefined;
  children: ReactElement;
}

export function ButtonTooltip(props: ButtonTooltipProps): ReactElement {
  const { title, disabled, placement, arrow, children } = props;

  // A disabled button emits no pointer events, so the tooltip needs an enabled span to hover over.
  if (disabled) {
    return (
      <Tooltip title={title} placement={placement} arrow={arrow}>
        <Box component="span" sx={{ display: "inline-flex" }}>
          {children}
        </Box>
      </Tooltip>
    );
  }

  return (
    <Tooltip title={title} placement={placement} arrow={arrow}>
      {children}
    </Tooltip>
  );
}
